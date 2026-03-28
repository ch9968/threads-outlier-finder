import { describe, it, expect } from "vitest";
import {
  ApifyPostSchema,
  ApifyActorInputSchema,
  ApifyWebhookPayloadSchema,
  normalizeMediaType,
  calculateTotalEngagement,
  extractProfileFromPost,
  parseTakenAt,
  APIFY_ACTOR_ID,
  MAX_POSTS_PER_USER,
} from "../../src/lib/apify/schema";

describe("APIFY_ACTOR_ID", () => {
  it("should be thenetaji/threads-scraper", () => {
    expect(APIFY_ACTOR_ID).toBe("thenetaji/threads-scraper");
  });

  it("should have MAX_POSTS_PER_USER of 200", () => {
    expect(MAX_POSTS_PER_USER).toBe(200);
  });
});

describe("ApifyPostSchema", () => {
  const validPost = {
    type: "thread",
    thread: {
      pk: "3220231147841639674",
      code: "Cywjyrdv9T6",
      caption: { text: "Hello Threads!" },
      taken_at: 1698101489,
      like_count: 8,
      media_type: 19,
      user: {
        pk: "314216",
        username: "joshproductletter",
        full_name: "Josh",
        is_verified: false,
        profile_pic_url: "https://scontent.cdninstagram.com/pic.jpg",
      },
      text_post_app_info: {
        direct_reply_count: 3,
        repost_count: 0,
        quote_count: 0,
        reshare_count: 0,
        is_reply: false,
      },
    },
  };

  it("should parse a valid post", () => {
    const result = ApifyPostSchema.parse(validPost);
    expect(result.thread.code).toBe("Cywjyrdv9T6");
    expect(result.thread.like_count).toBe(8);
    expect(result.thread.user.username).toBe("joshproductletter");
  });

  it("should require thread.code", () => {
    const noCode = {
      ...validPost,
      thread: { ...validPost.thread, code: undefined },
    };
    expect(() => ApifyPostSchema.parse(noCode)).toThrow();
  });

  it("should require thread.user.username", () => {
    const noUsername = {
      ...validPost,
      thread: {
        ...validPost.thread,
        user: { ...validPost.thread.user, username: undefined },
      },
    };
    expect(() => ApifyPostSchema.parse(noUsername)).toThrow();
  });

  it("should require thread.taken_at", () => {
    const noTimestamp = {
      ...validPost,
      thread: { ...validPost.thread, taken_at: undefined },
    };
    expect(() => ApifyPostSchema.parse(noTimestamp)).toThrow();
  });

  it("should default engagement counts to 0", () => {
    const noEngagement = {
      ...validPost,
      thread: {
        ...validPost.thread,
        like_count: undefined,
        text_post_app_info: {
          // omit counts — should default to 0
          is_reply: false,
        },
      },
    };
    const result = ApifyPostSchema.parse(noEngagement);
    expect(result.thread.like_count).toBe(0);
    expect(result.thread.text_post_app_info.direct_reply_count).toBe(0);
    expect(result.thread.text_post_app_info.repost_count).toBe(0);
    expect(result.thread.text_post_app_info.quote_count).toBe(0);
  });

  it("should reject negative like_count", () => {
    expect(() =>
      ApifyPostSchema.parse({
        ...validPost,
        thread: { ...validPost.thread, like_count: -1 },
      })
    ).toThrow();
  });

  it("should allow null caption", () => {
    const result = ApifyPostSchema.parse({
      ...validPost,
      thread: { ...validPost.thread, caption: null },
    });
    expect(result.thread.caption).toBeNull();
  });

  it("should parse minimal post (only required fields)", () => {
    const minimal = {
      thread: {
        code: "ABC123",
        taken_at: 1698101489,
        media_type: 19,
        like_count: 0,
        user: { username: "test", is_verified: false },
        text_post_app_info: { is_reply: false },
      },
    };
    const result = ApifyPostSchema.parse(minimal);
    expect(result.thread.code).toBe("ABC123");
    expect(result.thread.like_count).toBe(0);
  });
});

describe("extractProfileFromPost", () => {
  it("should extract profile data from a post item", () => {
    const post = ApifyPostSchema.parse({
      thread: {
        code: "ABC",
        taken_at: 1698101489,
        media_type: 19,
        like_count: 0,
        user: {
          username: "JoshProductLetter",
          full_name: "Josh Letter",
          is_verified: true,
          profile_pic_url: "https://example.com/pic.jpg",
        },
        text_post_app_info: { is_reply: false },
      },
    });

    const profile = extractProfileFromPost(post);
    expect(profile.username).toBe("joshproductletter"); // lowercased
    expect(profile.profilePicUrl).toBe("https://example.com/pic.jpg");
    expect(profile.displayName).toBe("Josh Letter");
    expect(profile.isVerified).toBe(true);
    expect(profile.followerCount).toBeNull();
    expect(profile.biography).toBeNull();
  });

  it("should handle missing optional profile fields", () => {
    const post = ApifyPostSchema.parse({
      thread: {
        code: "ABC",
        taken_at: 1698101489,
        media_type: 19,
        like_count: 0,
        user: { username: "test", is_verified: false },
        text_post_app_info: { is_reply: false },
      },
    });

    const profile = extractProfileFromPost(post);
    expect(profile.profilePicUrl).toBeNull();
    expect(profile.displayName).toBeNull();
  });
});

describe("ApifyActorInputSchema", () => {
  it("should parse valid input", () => {
    const result = ApifyActorInputSchema.parse({
      input: [{ url: "https://www.threads.net/@zuck" }],
      maxThreads: 50,
    });
    expect(result.maxThreads).toBe(50);
    expect(result.input[0].url).toBe("https://www.threads.net/@zuck");
  });

  it("should default maxThreads to MAX_POSTS_PER_USER", () => {
    const result = ApifyActorInputSchema.parse({
      input: [{ url: "https://www.threads.net/@zuck" }],
    });
    expect(result.maxThreads).toBe(MAX_POSTS_PER_USER);
  });

  it("should reject maxThreads > 200", () => {
    expect(() =>
      ApifyActorInputSchema.parse({
        input: [{ url: "https://www.threads.net/@zuck" }],
        maxThreads: 201,
      })
    ).toThrow();
  });

  it("should reject missing input array", () => {
    expect(() =>
      ApifyActorInputSchema.parse({ maxThreads: 50 })
    ).toThrow();
  });
});

describe("ApifyWebhookPayloadSchema", () => {
  const validPayload = {
    userId: "user123",
    createdAt: "2026-03-05T22:33:31.392Z",
    eventType: "ACTOR.RUN.SUCCEEDED" as const,
    eventData: {
      actorId: "thenetaji/threads-scraper",
      actorRunId: "run123",
    },
    resource: {
      id: "run123",
      actId: "thenetaji/threads-scraper",
      status: "SUCCEEDED" as const,
      defaultDatasetId: "dataset123",
    },
  };

  it("should parse a valid SUCCEEDED payload", () => {
    const result = ApifyWebhookPayloadSchema.parse(validPayload);
    expect(result.eventType).toBe("ACTOR.RUN.SUCCEEDED");
    expect(result.resource.defaultDatasetId).toBe("dataset123");
  });

  it("should parse a FAILED payload", () => {
    const result = ApifyWebhookPayloadSchema.parse({
      ...validPayload,
      eventType: "ACTOR.RUN.FAILED",
      resource: { ...validPayload.resource, status: "FAILED" },
    });
    expect(result.eventType).toBe("ACTOR.RUN.FAILED");
  });

  it("should parse TIMED_OUT payload", () => {
    const result = ApifyWebhookPayloadSchema.parse({
      ...validPayload,
      eventType: "ACTOR.RUN.TIMED_OUT",
      resource: { ...validPayload.resource, status: "TIMED-OUT" },
    });
    expect(result.resource.status).toBe("TIMED-OUT");
  });

  it("should accept optional stats", () => {
    const result = ApifyWebhookPayloadSchema.parse({
      ...validPayload,
      resource: {
        ...validPayload.resource,
        stats: { datasetItemCount: 50 },
      },
    });
    expect(result.resource.stats?.datasetItemCount).toBe(50);
  });

  it("should reject invalid eventType", () => {
    expect(() =>
      ApifyWebhookPayloadSchema.parse({
        ...validPayload,
        eventType: "ACTOR.RUN.UNKNOWN",
      })
    ).toThrow();
  });
});

describe("normalizeMediaType", () => {
  it("should return text for media_type 19 (text-only post)", () => {
    expect(normalizeMediaType(19)).toBe("text");
  });

  it("should return image for media_type 1", () => {
    expect(normalizeMediaType(1)).toBe("image");
  });

  it("should return video for media_type 2", () => {
    expect(normalizeMediaType(2)).toBe("video");
  });

  it("should return carousel for media_type 8", () => {
    expect(normalizeMediaType(8)).toBe("carousel");
  });

  it("should return text for unknown media_type", () => {
    expect(normalizeMediaType(99)).toBe("text");
  });
});

describe("calculateTotalEngagement", () => {
  it("should sum like_count + repost_count + direct_reply_count", () => {
    const post = ApifyPostSchema.parse({
      thread: {
        code: "1",
        taken_at: 1698101489,
        media_type: 19,
        like_count: 100,
        user: { username: "test", is_verified: false },
        text_post_app_info: {
          direct_reply_count: 50,
          repost_count: 25,
          quote_count: 10,
          is_reply: false,
        },
      },
    });
    expect(calculateTotalEngagement(post)).toBe(175);
  });

  it("should NOT include quote_count in total", () => {
    const post = ApifyPostSchema.parse({
      thread: {
        code: "1",
        taken_at: 1698101489,
        media_type: 19,
        like_count: 0,
        user: { username: "test", is_verified: false },
        text_post_app_info: {
          direct_reply_count: 0,
          repost_count: 0,
          quote_count: 100,
          is_reply: false,
        },
      },
    });
    expect(calculateTotalEngagement(post)).toBe(0);
  });

  it("should return 0 for zero engagement", () => {
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
});

describe("parseTakenAt", () => {
  it("should parse unix timestamp to ISO 8601", () => {
    // epoch 0 → 1970-01-01T00:00:00.000Z
    expect(parseTakenAt(0)).toBe("1970-01-01T00:00:00.000Z");
  });

  it("should parse a real timestamp correctly", () => {
    const result = parseTakenAt(1698101489);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(new Date(result).getTime()).toBe(1698101489 * 1000);
  });

  it("should throw on invalid timestamp", () => {
    expect(() => parseTakenAt(NaN)).toThrow("Invalid taken_at timestamp");
  });
});
