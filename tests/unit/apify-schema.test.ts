import { describe, it, expect } from "vitest";
import {
  ApifyProfileSchema,
  ApifyPostSchema,
  ApifyDatasetItemSchema,
  ApifyActorInputSchema,
  ApifyWebhookPayloadSchema,
  normalizeMediaType,
  calculateTotalEngagement,
  APIFY_ACTOR_ID,
  MAX_POSTS_PER_USER,
} from "../../src/lib/apify/schema";

describe("APIFY_ACTOR_ID", () => {
  it("should be automation-lab/threads-scraper", () => {
    expect(APIFY_ACTOR_ID).toBe("automation-lab/threads-scraper");
  });

  it("should have MAX_POSTS_PER_USER of 200", () => {
    expect(MAX_POSTS_PER_USER).toBe(200);
  });
});

describe("ApifyProfileSchema", () => {
  const validProfile = {
    type: "profile" as const,
    username: "zuck",
    fullName: "Mark Zuckerberg",
    biography: "I build stuff",
    followerCount: 5439932,
    isVerified: true,
    profilePicUrl: "https://scontent.cdninstagram.com/pic.jpg",
    url: "https://www.threads.com/@zuck",
    userId: "314216",
    scrapedAt: "2026-03-05T22:33:31.392Z",
  };

  it("should parse a valid profile", () => {
    const result = ApifyProfileSchema.parse(validProfile);
    expect(result.username).toBe("zuck");
    expect(result.followerCount).toBe(5439932);
    expect(result.type).toBe("profile");
  });

  it("should require type to be 'profile'", () => {
    expect(() =>
      ApifyProfileSchema.parse({ ...validProfile, type: "post" })
    ).toThrow();
  });

  it("should require username", () => {
    const { username, ...noUsername } = validProfile;
    expect(() => ApifyProfileSchema.parse(noUsername)).toThrow();
  });

  it("should allow null/optional fields", () => {
    const minimal = {
      type: "profile" as const,
      username: "test",
    };
    const result = ApifyProfileSchema.parse(minimal);
    expect(result.username).toBe("test");
    expect(result.fullName).toBeUndefined();
    expect(result.followerCount).toBeUndefined();
  });

  it("should allow null fullName", () => {
    const result = ApifyProfileSchema.parse({
      ...validProfile,
      fullName: null,
    });
    expect(result.fullName).toBeNull();
  });
});

describe("ApifyPostSchema", () => {
  const validPost = {
    type: "post" as const,
    postId: "3798699639419459235",
    code: "DS3sTIYAFaj",
    url: "https://www.threads.com/t/DS3sTIYAFaj",
    username: "zuck",
    fullName: "Mark Zuckerberg",
    isVerified: true,
    text: "Hello Threads!",
    hashtags: ["tech"],
    mentions: ["@meta"],
    urls: [],
    likeCount: 4969,
    replyCount: 1034,
    repostCount: 372,
    quoteCount: 277,
    mediaType: "text" as const,
    media: [],
    isReply: false,
    isRepost: false,
    repostedFrom: null,
    timestamp: 1764792059,
    date: "2025-12-03T20:00:59.000Z",
    scrapedAt: "2026-03-05T22:36:51.325Z",
  };

  it("should parse a valid post", () => {
    const result = ApifyPostSchema.parse(validPost);
    expect(result.postId).toBe("3798699639419459235");
    expect(result.likeCount).toBe(4969);
    expect(result.type).toBe("post");
  });

  it("should require type to be 'post'", () => {
    expect(() =>
      ApifyPostSchema.parse({ ...validPost, type: "profile" })
    ).toThrow();
  });

  it("should default engagement counts to 0", () => {
    const { likeCount, replyCount, repostCount, quoteCount, ...rest } =
      validPost;
    const result = ApifyPostSchema.parse(rest);
    expect(result.likeCount).toBe(0);
    expect(result.replyCount).toBe(0);
    expect(result.repostCount).toBe(0);
    expect(result.quoteCount).toBe(0);
  });

  it("should default mediaType to text", () => {
    const { mediaType, ...rest } = validPost;
    const result = ApifyPostSchema.parse(rest);
    expect(result.mediaType).toBe("text");
  });

  it("should default arrays to empty", () => {
    const { hashtags, mentions, urls, media, ...rest } = validPost;
    const result = ApifyPostSchema.parse(rest);
    expect(result.hashtags).toEqual([]);
    expect(result.mentions).toEqual([]);
    expect(result.urls).toEqual([]);
    expect(result.media).toEqual([]);
  });

  it("should default isReply and isRepost to false", () => {
    const { isReply, isRepost, ...rest } = validPost;
    const result = ApifyPostSchema.parse(rest);
    expect(result.isReply).toBe(false);
    expect(result.isRepost).toBe(false);
  });

  it("should reject negative engagement counts", () => {
    expect(() =>
      ApifyPostSchema.parse({ ...validPost, likeCount: -1 })
    ).toThrow();
  });

  it("should allow null text", () => {
    const result = ApifyPostSchema.parse({ ...validPost, text: null });
    expect(result.text).toBeNull();
  });

  it("should parse photo mediaType", () => {
    const result = ApifyPostSchema.parse({
      ...validPost,
      mediaType: "photo",
    });
    expect(result.mediaType).toBe("photo");
  });

  it("should parse carousel mediaType", () => {
    const result = ApifyPostSchema.parse({
      ...validPost,
      mediaType: "carousel",
    });
    expect(result.mediaType).toBe("carousel");
  });
});

describe("ApifyDatasetItemSchema (discriminated union)", () => {
  it("should parse a profile by type field", () => {
    const item = { type: "profile" as const, username: "test" };
    const result = ApifyDatasetItemSchema.parse(item);
    expect(result.type).toBe("profile");
  });

  it("should parse a post by type field", () => {
    const item = {
      type: "post" as const,
      postId: "123",
      username: "test",
      timestamp: 1234567890,
      date: "2025-01-01T00:00:00.000Z",
    };
    const result = ApifyDatasetItemSchema.parse(item);
    expect(result.type).toBe("post");
  });

  it("should reject unknown type", () => {
    expect(() =>
      ApifyDatasetItemSchema.parse({ type: "unknown", username: "test" })
    ).toThrow();
  });
});

describe("ApifyActorInputSchema", () => {
  it("should parse valid input", () => {
    const result = ApifyActorInputSchema.parse({
      mode: "posts",
      usernames: ["zuck"],
      maxPosts: 50,
      includeProfile: true,
    });
    expect(result.mode).toBe("posts");
    expect(result.maxPosts).toBe(50);
  });

  it("should default mode to posts", () => {
    const result = ApifyActorInputSchema.parse({
      usernames: ["zuck"],
    });
    expect(result.mode).toBe("posts");
  });

  it("should default maxPosts to 200", () => {
    const result = ApifyActorInputSchema.parse({
      usernames: ["zuck"],
    });
    expect(result.maxPosts).toBe(200);
  });

  it("should default includeProfile to true", () => {
    const result = ApifyActorInputSchema.parse({
      usernames: ["zuck"],
    });
    expect(result.includeProfile).toBe(true);
  });

  it("should reject maxPosts > 200", () => {
    expect(() =>
      ApifyActorInputSchema.parse({
        usernames: ["zuck"],
        maxPosts: 201,
      })
    ).toThrow();
  });

  it("should reject empty usernames", () => {
    expect(() =>
      ApifyActorInputSchema.parse({
        usernames: [],
      })
    ).toThrow();
  });

  it("should reject empty username string", () => {
    expect(() =>
      ApifyActorInputSchema.parse({
        usernames: [""],
      })
    ).toThrow();
  });
});

describe("ApifyWebhookPayloadSchema", () => {
  const validPayload = {
    userId: "user123",
    createdAt: "2026-03-05T22:33:31.392Z",
    eventType: "ACTOR.RUN.SUCCEEDED" as const,
    eventData: {
      actorId: "automation-lab/threads-scraper",
      actorRunId: "run123",
    },
    resource: {
      id: "run123",
      actId: "automation-lab/threads-scraper",
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
  it("should map photo to image", () => {
    expect(normalizeMediaType("photo")).toBe("image");
  });

  it("should keep carousel", () => {
    expect(normalizeMediaType("carousel")).toBe("carousel");
  });

  it("should keep video", () => {
    expect(normalizeMediaType("video")).toBe("video");
  });

  it("should default undefined to text", () => {
    expect(normalizeMediaType(undefined)).toBe("text");
  });

  it("should default unknown values to text", () => {
    expect(normalizeMediaType("unknown")).toBe("text");
  });

  it("should default text to text", () => {
    expect(normalizeMediaType("text")).toBe("text");
  });
});

describe("calculateTotalEngagement", () => {
  it("should sum likeCount + repostCount + replyCount", () => {
    const post = ApifyPostSchema.parse({
      type: "post",
      postId: "1",
      username: "test",
      likeCount: 100,
      replyCount: 50,
      repostCount: 25,
      quoteCount: 10,
      timestamp: 1234567890,
      date: "2025-01-01T00:00:00.000Z",
    });
    expect(calculateTotalEngagement(post)).toBe(175);
  });

  it("should NOT include quoteCount in total", () => {
    const post = ApifyPostSchema.parse({
      type: "post",
      postId: "1",
      username: "test",
      likeCount: 0,
      replyCount: 0,
      repostCount: 0,
      quoteCount: 100,
      timestamp: 1234567890,
      date: "2025-01-01T00:00:00.000Z",
    });
    expect(calculateTotalEngagement(post)).toBe(0);
  });

  it("should return 0 for zero engagement", () => {
    const post = ApifyPostSchema.parse({
      type: "post",
      postId: "1",
      username: "test",
      timestamp: 1234567890,
      date: "2025-01-01T00:00:00.000Z",
    });
    expect(calculateTotalEngagement(post)).toBe(0);
  });
});
