import { describe, it, expect } from "vitest";
import { calculateOutlierScores } from "../../src/lib/outlier";
import { normalizeMediaType, calculateTotalEngagement, ApifyPostSchema } from "../../src/lib/apify/schema";

describe("Edge cases: outlier scoring with mixed content", () => {
  function makePost(
    id: string,
    engagement: number,
    postedAt: string,
    overrides: { isReply?: boolean; isRepost?: boolean } = {}
  ) {
    return {
      id,
      totalEngagement: engagement,
      isReply: overrides.isReply ?? false,
      isRepost: overrides.isRepost ?? false,
      postedAt: new Date(postedAt),
    };
  }

  it("should handle mix of original posts, replies, and reposts", () => {
    const posts = [
      makePost("orig1", 100, "2025-01-01"),
      makePost("orig2", 200, "2025-01-02"),
      makePost("orig3", 300, "2025-01-03"),
      makePost("reply1", 50, "2025-01-04", { isReply: true }),
      makePost("repost1", 1000, "2025-01-05", { isRepost: true }),
    ];

    const scores = calculateOutlierScores(posts);

    // Baseline = (100+200+300)/3 = 200 (only original posts)
    expect(scores.find((s) => s.id === "orig3")?.outlierScore).toBe(1.5);
    expect(scores.find((s) => s.id === "reply1")?.outlierScore).toBeNull();
    expect(scores.find((s) => s.id === "repost1")?.outlierScore).toBeNull();
  });

  it("should handle very large engagement numbers", () => {
    const posts = [
      makePost("viral", 10_000_000, "2025-01-02"),
      makePost("normal", 1_000, "2025-01-01"),
    ];

    const scores = calculateOutlierScores(posts);
    // avg = (10000000+1000)/2 = 5000500
    const viral = scores.find((s) => s.id === "viral");
    expect(viral?.outlierScore).toBeGreaterThan(1);
  });

  it("should handle all posts having the same engagement", () => {
    const posts = Array.from({ length: 5 }, (_, i) =>
      makePost(`p${i}`, 100, `2025-01-${String(i + 1).padStart(2, "0")}`)
    );

    const scores = calculateOutlierScores(posts);
    // All should be exactly 1.0x
    expect(scores.every((s) => s.outlierScore === 1)).toBe(true);
  });

  it("should handle exactly 11 posts (boundary)", () => {
    const posts = Array.from({ length: 11 }, (_, i) =>
      makePost(`p${i}`, (i + 1) * 10, `2025-01-${String(i + 1).padStart(2, "0")}`)
    );

    const scores = calculateOutlierScores(posts);
    // Latest 10: p1-p10, avg = (20+30+...+110)/10 = 65
    // p0 (10 engagement): 10/65 ≈ 0.15
    expect(scores.find((s) => s.id === "p0")?.outlierScore).toBeCloseTo(0.15, 1);
  });
});

describe("Edge cases: Apify data normalization", () => {
  it("should handle post with all zero engagement", () => {
    const post = ApifyPostSchema.parse({
      thread: {
        code: "1",
        taken_at: 1698101489,
        media_type: 19,
        like_count: 0,
        user: { username: "test", is_verified: false },
        text_post_app_info: { is_reply: false },
      },
    });

    expect(calculateTotalEngagement(post)).toBe(0);
  });

  it("should normalize all media types correctly", () => {
    expect(normalizeMediaType(19)).toBe("text");
    expect(normalizeMediaType(2)).toBe("video");
    expect(normalizeMediaType(8)).toBe("carousel");
    expect(normalizeMediaType(1)).toBe("image");
  });
});
