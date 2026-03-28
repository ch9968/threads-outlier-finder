import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase client with chainable API
function createChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.upsert = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
  return chain;
}

let mockChain = createChain();
const mockFrom = vi.fn(() => mockChain);

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: (...args: Parameters<typeof mockFrom>) => mockFrom(...args),
  },
}));

vi.mock("@/lib/apify/client", () => ({
  startApifyRun: vi.fn(),
  getApifyRunStatus: vi.fn(),
  fetchDatasetItems: vi.fn(),
}));

import { startScraping, pollApifyRun } from "@/lib/actions/scraping";
import { startApifyRun, getApifyRunStatus, fetchDatasetItems } from "@/lib/apify/client";

const mockedStartApifyRun = vi.mocked(startApifyRun);
const mockedGetApifyRunStatus = vi.mocked(getApifyRunStatus);
const mockedFetchDatasetItems = vi.mocked(fetchDatasetItems);

function makeFormData(username: string): FormData {
  const fd = new FormData();
  fd.set("username", username);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockChain = createChain();
  mockFrom.mockReturnValue(mockChain);
});

describe("startScraping — cooldown logic", () => {
  it("returns existing job when account is within cooldown", async () => {
    let callCount = 0;
    mockChain.single = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ data: null, error: null }); // no active job
      if (callCount === 2) {
        // Account within cooldown (scraped 30 min ago)
        const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        return Promise.resolve({
          data: { last_scraped_at: thirtyMinAgo },
          error: null,
        });
      }
      // Return latest completed job
      return Promise.resolve({ data: { id: "completed-job-1" }, error: null });
    });

    const result = await startScraping(makeFormData("testuser"));
    expect(result.data).toEqual({ jobId: "completed-job-1", isExisting: true });
    expect(result.error).toBeNull();
    // Should not have called startApifyRun
    expect(mockedStartApifyRun).not.toHaveBeenCalled();
  });

  it("skips cooldown when account has no last_scraped_at", async () => {
    let callCount = 0;
    mockChain.single = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ data: null, error: null }); // no active job
      if (callCount === 2) return Promise.resolve({ data: null, error: null }); // no account
      return Promise.resolve({ data: { id: "new-job-1" }, error: null }); // insert
    });
    mockedStartApifyRun.mockResolvedValue({
      id: "run-1",
      datasetId: "ds-1",
    } as ReturnType<typeof startApifyRun> extends Promise<infer T> ? T : never);

    const result = await startScraping(makeFormData("testuser"));
    expect(result.data?.isExisting).toBe(false);
    expect(mockedStartApifyRun).toHaveBeenCalled();
  });

  it("proceeds with new job when cooldown has expired", async () => {
    let callCount = 0;
    mockChain.single = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ data: null, error: null }); // no active job
      if (callCount === 2) {
        // Account with expired cooldown (scraped 2 hours ago)
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        return Promise.resolve({
          data: { last_scraped_at: twoHoursAgo },
          error: null,
        });
      }
      return Promise.resolve({ data: { id: "new-job-2" }, error: null }); // insert
    });
    mockedStartApifyRun.mockResolvedValue({
      id: "run-2",
      datasetId: "ds-2",
    } as ReturnType<typeof startApifyRun> extends Promise<infer T> ? T : never);

    const result = await startScraping(makeFormData("testuser"));
    expect(result.data?.isExisting).toBe(false);
    expect(mockedStartApifyRun).toHaveBeenCalled();
  });

  it("rejects username exceeding max length", async () => {
    const longName = "a".repeat(31);
    const result = await startScraping(makeFormData(longName));
    expect(result.error).toBeTruthy();
  });
});

describe("startScraping — Apify error cleanup", () => {
  it("cleans up pending job when Apify call throws", async () => {
    let callCount = 0;
    mockChain.single = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ data: null, error: null }); // no active job
      if (callCount === 2) return Promise.resolve({ data: null, error: null }); // no account
      return Promise.resolve({ data: { id: "job-to-clean" }, error: null }); // insert
    });

    mockedStartApifyRun.mockRejectedValue(new Error("Apify unavailable"));

    const result = await startScraping(makeFormData("testuser"));
    expect(result.error).toBe("Failed to start analysis. Please try again.");
    // Verify the update was called to mark job as failed
    expect(mockFrom).toHaveBeenCalledWith("scrape_jobs");
  });
});

describe("pollApifyRun — SUCCEEDED data processing", () => {
  function setupSucceededRun() {
    let callCount = 0;
    mockChain.single = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          data: { id: "j1", status: "scraping", apify_run_id: "run-1", dataset_id: "ds-1" },
          error: null,
        });
      }
      // account upsert
      return Promise.resolve({ data: { id: "account-1" }, error: null });
    });

    mockedGetApifyRunStatus.mockResolvedValue({
      status: "SUCCEEDED",
      datasetId: "ds-1",
    } as ReturnType<typeof getApifyRunStatus> extends Promise<infer T> ? T : never);
  }

  it("processes valid dataset items and returns ready", async () => {
    setupSucceededRun();

    mockedFetchDatasetItems.mockResolvedValue([
      {
        type: "thread",
        thread: {
          code: "abc123",
          taken_at: 1698101489,
          like_count: 100,
          media_type: 1,
          caption: { text: "Hello world" },
          user: {
            username: "testuser",
            full_name: "Test User",
            is_verified: false,
            profile_pic_url: "https://example.com/pic.jpg",
          },
          text_post_app_info: {
            direct_reply_count: 5,
            repost_count: 10,
            quote_count: 2,
            reshare_count: 0,
            is_reply: false,
          },
        },
      },
    ]);

    const result = await pollApifyRun("testuser");
    expect(result.data?.status).toBe("ready");
    expect(result.data?.postCount).toBe(1);
    expect(result.error).toBeNull();
  });

  it("returns failed when all items are malformed", async () => {
    setupSucceededRun();
    mockedFetchDatasetItems.mockResolvedValue([
      { bad: "data" },
      { incomplete: true },
    ]);

    const result = await pollApifyRun("testuser");
    expect(result.data?.status).toBe("failed");
    expect(result.data?.errorMessage).toContain("No posts found");
  });

  it("returns failed when account upsert fails", async () => {
    let callCount = 0;
    mockChain.single = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          data: { id: "j1", status: "scraping", apify_run_id: "run-1", dataset_id: "ds-1" },
          error: null,
        });
      }
      // account upsert fails
      return Promise.resolve({ data: null, error: { message: "DB error" } });
    });

    mockedGetApifyRunStatus.mockResolvedValue({
      status: "SUCCEEDED",
      datasetId: "ds-1",
    } as ReturnType<typeof getApifyRunStatus> extends Promise<infer T> ? T : never);

    mockedFetchDatasetItems.mockResolvedValue([
      {
        type: "thread",
        thread: {
          code: "xyz789",
          taken_at: 1698101489,
          like_count: 50,
          media_type: 19,
          caption: { text: "Hello" },
          user: {
            username: "testuser",
            full_name: "Test User",
            is_verified: false,
            profile_pic_url: "https://example.com/pic.jpg",
          },
          text_post_app_info: {
            direct_reply_count: 3,
            repost_count: 5,
            quote_count: 1,
            reshare_count: 0,
            is_reply: false,
          },
        },
      },
    ]);

    const result = await pollApifyRun("testuser");
    expect(result.data?.status).toBe("failed");
    expect(result.data?.errorMessage).toBe("Database error");
  });
});

describe("pollApifyRun — TIMED-OUT status", () => {
  it("returns failed with timeout message", async () => {
    mockChain.single = vi.fn().mockResolvedValue({
      data: { id: "j1", status: "scraping", apify_run_id: "run-1", dataset_id: "ds-1" },
      error: null,
    });
    mockedGetApifyRunStatus.mockResolvedValue({
      status: "TIMED-OUT",
      datasetId: "ds-1",
    } as ReturnType<typeof getApifyRunStatus> extends Promise<infer T> ? T : never);

    const result = await pollApifyRun("testuser");
    expect(result.data?.status).toBe("failed");
    expect(result.data?.errorMessage).toContain("timed out");
  });
});

describe("pollApifyRun — unknown status", () => {
  it("returns failed with unknown error", async () => {
    mockChain.single = vi.fn().mockResolvedValue({
      data: { id: "j1", status: "scraping", apify_run_id: "run-1", dataset_id: "ds-1" },
      error: null,
    });
    mockedGetApifyRunStatus.mockResolvedValue({
      status: "WEIRD_STATUS",
      datasetId: "ds-1",
    } as ReturnType<typeof getApifyRunStatus> extends Promise<infer T> ? T : never);

    const result = await pollApifyRun("testuser");
    expect(result.data?.status).toBe("failed");
    expect(result.data?.errorMessage).toBe("Unknown error");
  });
});

describe("pollApifyRun — no active job fallback", () => {
  it("falls back to getJobStatus when no active job found", async () => {
    let callCount = 0;
    mockChain.single = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // No active job found
        return Promise.resolve({ data: null, error: null });
      }
      // getJobStatus call
      return Promise.resolve({
        data: { id: "j-old", status: "ready", error_message: null, post_count: 50 },
        error: null,
      });
    });

    const result = await pollApifyRun("testuser");
    expect(result.data?.status).toBe("ready");
    expect(result.data?.postCount).toBe(50);
  });
});
