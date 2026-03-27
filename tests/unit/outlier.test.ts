import { describe, it, expect } from "vitest";
import {
  calculateOutlierScores,
  isSmallSampleBaseline,
} from "../../src/lib/outlier";

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

describe("calculateOutlierScores", () => {
  it("should calculate scores based on latest 10 average", () => {
    // 12 posts: engagements 10,20,...,120
    // Latest 10 by date: p2-p11 (30,40,...,120)
    // avg = (30+40+50+60+70+80+90+100+110+120)/10 = 750/10 = 75
    const posts = Array.from({ length: 12 }, (_, i) =>
      makePost(`p${i}`, (i + 1) * 10, `2025-01-${String(i + 1).padStart(2, "0")}`)
    );

    const scores = calculateOutlierScores(posts);

    // p11 (120 engagement): 120/75 = 1.6
    const topPost = scores.find((s) => s.id === "p11");
    expect(topPost?.outlierScore).toBe(1.6);

    // p0 (10 engagement): 10/75 ≈ 0.13
    const lowPost = scores.find((s) => s.id === "p0");
    expect(lowPost?.outlierScore).toBeCloseTo(0.13, 1);
  });

  it("should use all posts when fewer than 11 original posts", () => {
    const posts = [
      makePost("p1", 100, "2025-01-01"),
      makePost("p2", 200, "2025-01-02"),
      makePost("p3", 300, "2025-01-03"),
    ];
    // avg = (100+200+300)/3 = 200
    const scores = calculateOutlierScores(posts);

    const p3 = scores.find((s) => s.id === "p3");
    expect(p3?.outlierScore).toBe(1.5); // 300/200
  });

  it("should return 0 when baseline is 0", () => {
    const posts = [
      makePost("p1", 0, "2025-01-01"),
      makePost("p2", 0, "2025-01-02"),
    ];

    const scores = calculateOutlierScores(posts);
    expect(scores.every((s) => s.outlierScore === 0)).toBe(true);
  });

  it("should assign null score to replies", () => {
    const posts = [
      makePost("p1", 100, "2025-01-01"),
      makePost("p2", 50, "2025-01-02", { isReply: true }),
    ];

    const scores = calculateOutlierScores(posts);
    const reply = scores.find((s) => s.id === "p2");
    expect(reply?.outlierScore).toBeNull();
  });

  it("should assign null score to reposts", () => {
    const posts = [
      makePost("p1", 100, "2025-01-01"),
      makePost("p2", 500, "2025-01-02", { isRepost: true }),
    ];

    const scores = calculateOutlierScores(posts);
    const repost = scores.find((s) => s.id === "p2");
    expect(repost?.outlierScore).toBeNull();
  });

  it("should exclude replies/reposts from baseline calculation", () => {
    const posts = [
      makePost("p1", 100, "2025-01-01"),
      makePost("p2", 200, "2025-01-02"),
      makePost("reply", 10000, "2025-01-03", { isReply: true }),
    ];
    // Baseline should be (100+200)/2 = 150, NOT including reply's 10000
    const scores = calculateOutlierScores(posts);

    const p2 = scores.find((s) => s.id === "p2");
    expect(p2?.outlierScore).toBeCloseTo(1.33, 1); // 200/150
  });

  it("should return all null when only replies/reposts exist", () => {
    const posts = [
      makePost("r1", 100, "2025-01-01", { isReply: true }),
      makePost("r2", 200, "2025-01-02", { isRepost: true }),
    ];

    const scores = calculateOutlierScores(posts);
    expect(scores.every((s) => s.outlierScore === null)).toBe(true);
  });

  it("should handle empty input", () => {
    const scores = calculateOutlierScores([]);
    expect(scores).toEqual([]);
  });

  it("should handle single post", () => {
    const posts = [makePost("p1", 100, "2025-01-01")];
    const scores = calculateOutlierScores(posts);
    // avg = 100/1 = 100, score = 100/100 = 1
    expect(scores[0].outlierScore).toBe(1);
  });

  it("should use latest 10 by date, not by position", () => {
    // Create 12 posts where the 2 oldest have very high engagement
    const posts = [
      makePost("old1", 10000, "2024-01-01"),
      makePost("old2", 10000, "2024-01-02"),
      ...Array.from({ length: 10 }, (_, i) =>
        makePost(`new${i}`, 100, `2025-01-${String(i + 1).padStart(2, "0")}`)
      ),
    ];

    const scores = calculateOutlierScores(posts);

    // Baseline = avg of latest 10 = 100
    // old1 with 10000 = 10000/100 = 100x
    const old1 = scores.find((s) => s.id === "old1");
    expect(old1?.outlierScore).toBe(100);
  });
});

describe("isSmallSampleBaseline", () => {
  it("should return true when fewer than 11 original posts", () => {
    const posts = Array.from({ length: 5 }, (_, i) =>
      makePost(`p${i}`, 100, `2025-01-${String(i + 1).padStart(2, "0")}`)
    );
    expect(isSmallSampleBaseline(posts)).toBe(true);
  });

  it("should return false when 11+ original posts", () => {
    const posts = Array.from({ length: 12 }, (_, i) =>
      makePost(`p${i}`, 100, `2025-01-${String(i + 1).padStart(2, "0")}`)
    );
    expect(isSmallSampleBaseline(posts)).toBe(false);
  });

  it("should not count replies toward original post count", () => {
    const posts = [
      ...Array.from({ length: 5 }, (_, i) =>
        makePost(`p${i}`, 100, `2025-01-${String(i + 1).padStart(2, "0")}`)
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        makePost(`r${i}`, 50, `2025-02-${String(i + 1).padStart(2, "0")}`, {
          isReply: true,
        })
      ),
    ];
    // Only 5 original posts, even though 15 total
    expect(isSmallSampleBaseline(posts)).toBe(true);
  });

  it("should return false when 0 original posts", () => {
    const posts = [
      makePost("r1", 100, "2025-01-01", { isReply: true }),
    ];
    expect(isSmallSampleBaseline(posts)).toBe(false);
  });
});
