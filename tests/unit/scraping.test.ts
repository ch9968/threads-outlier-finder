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

import { startScraping, pollApifyRun, getJobStatus } from "@/lib/actions/scraping";
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

describe("startScraping", () => {
  it("rejects invalid username", async () => {
    const result = await startScraping(makeFormData(""));
    expect(result.error).toBe("Username is required");
    expect(result.data).toBeNull();
  });

  it("rejects username with special characters", async () => {
    const result = await startScraping(makeFormData("user@name!"));
    expect(result.error).toBe("Invalid username format");
  });

  it("returns existing job if one is active", async () => {
    mockChain.single = vi.fn().mockResolvedValue({
      data: { id: "job-123", status: "scraping" },
      error: null,
    });

    const result = await startScraping(makeFormData("testuser"));
    expect(result.data).toEqual({ jobId: "job-123", isExisting: true });
    expect(result.error).toBeNull();
  });

  it("returns error when job insert fails", async () => {
    // First call: no active job
    // Second call: no account (cooldown check)
    // Third call: insert fails
    let callCount = 0;
    mockChain.single = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount <= 2) {
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({
        data: null,
        error: { message: "DB error", code: "42000" },
      });
    });

    const result = await startScraping(makeFormData("testuser"));
    expect(result.error).toBe("Failed to start analysis");
  });

  it("creates new job and starts Apify run on success", async () => {
    let callCount = 0;
    mockChain.single = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ data: null, error: null }); // no active job
      if (callCount === 2) return Promise.resolve({ data: null, error: null }); // no account
      return Promise.resolve({ data: { id: "new-job-1" }, error: null }); // insert
    });

    mockedStartApifyRun.mockResolvedValue({
      id: "run-abc",
      datasetId: "ds-xyz",
    } as ReturnType<typeof startApifyRun> extends Promise<infer T> ? T : never);

    const result = await startScraping(makeFormData("testuser"));
    expect(result.data).toEqual({ jobId: "new-job-1", isExisting: false });
    expect(mockedStartApifyRun).toHaveBeenCalledWith("testuser");
  });

  it("catches thrown errors gracefully", async () => {
    mockChain.single = vi.fn().mockRejectedValue(new Error("Network error"));

    const result = await startScraping(makeFormData("testuser"));
    expect(result.error).toBe("Failed to start analysis. Please try again.");
  });
});

describe("pollApifyRun", () => {
  it("rejects invalid username", async () => {
    const result = await pollApifyRun("");
    expect(result.error).toBe("Invalid username");
  });

  it("returns still-scraping when Apify is RUNNING", async () => {
    mockChain.single = vi.fn().mockResolvedValue({
      data: { id: "j1", status: "scraping", apify_run_id: "run-1", dataset_id: "ds-1" },
      error: null,
    });
    mockedGetApifyRunStatus.mockResolvedValue({
      status: "RUNNING",
      datasetId: "ds-1",
    } as ReturnType<typeof getApifyRunStatus> extends Promise<infer T> ? T : never);

    const result = await pollApifyRun("testuser");
    expect(result.data?.status).toBe("scraping");
  });

  it("returns failed when Apify run FAILED", async () => {
    mockChain.single = vi.fn().mockResolvedValue({
      data: { id: "j1", status: "scraping", apify_run_id: "run-1", dataset_id: "ds-1" },
      error: null,
    });
    mockedGetApifyRunStatus.mockResolvedValue({
      status: "FAILED",
      datasetId: "ds-1",
    } as ReturnType<typeof getApifyRunStatus> extends Promise<infer T> ? T : never);

    const result = await pollApifyRun("testuser");
    expect(result.data?.status).toBe("failed");
    expect(result.data?.errorMessage).toContain("private");
  });

  it("returns failed when dataset is empty", async () => {
    mockChain.single = vi.fn().mockResolvedValue({
      data: { id: "j1", status: "scraping", apify_run_id: "run-1", dataset_id: "ds-1" },
      error: null,
    });
    mockedGetApifyRunStatus.mockResolvedValue({
      status: "SUCCEEDED",
      datasetId: "ds-1",
    } as ReturnType<typeof getApifyRunStatus> extends Promise<infer T> ? T : never);
    mockedFetchDatasetItems.mockResolvedValue([]);

    const result = await pollApifyRun("testuser");
    expect(result.data?.status).toBe("failed");
    expect(result.data?.errorMessage).toContain("No data found");
  });

  it("catches thrown errors gracefully", async () => {
    mockChain.single = vi.fn().mockRejectedValue(new Error("Boom"));

    const result = await pollApifyRun("testuser");
    expect(result.error).toBe("Failed to check run status");
  });
});

describe("getJobStatus", () => {
  it("rejects invalid username", async () => {
    const result = await getJobStatus("");
    expect(result.error).toBe("Invalid username");
  });

  it("returns job data when found", async () => {
    mockChain.single = vi.fn().mockResolvedValue({
      data: { id: "j1", status: "ready", error_message: null, post_count: 42 },
      error: null,
    });

    const result = await getJobStatus("testuser");
    expect(result.data).toEqual({
      id: "j1",
      status: "ready",
      errorMessage: null,
      postCount: 42,
    });
  });

  it("returns error when no job found", async () => {
    mockChain.single = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "not found", code: "PGRST116" },
    });

    const result = await getJobStatus("nobody");
    expect(result.error).toBe("No job found for this username");
  });

  it("catches thrown errors gracefully", async () => {
    mockChain.single = vi.fn().mockRejectedValue(new Error("Timeout"));

    const result = await getJobStatus("testuser");
    expect(result.error).toBe("Failed to check status");
  });
});
