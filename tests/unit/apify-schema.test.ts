import { describe, it, expect } from "vitest";
import {
  ApifyPostSchema,
  ApifyActorInputSchema,
  ApifyWebhookPayloadSchema,
  normalizeMediaType,
  calculateTotalEngagement,
  extractProfileFromPost,
  APIFY_ACTOR_ID,
  MAX_POSTS_PER_USER,
} from "../../src/lib/apify/schema";

describe("APIFY_ACTOR_ID", () => {
  it("should be futurizerush/meta-threads-scraper", () => {
    expect(APIFY_ACTOR_ID).toBe("futurizerush/meta-threads-scraper");
  });

  it("should have MAX_POSTS_PER_USER of 200", () => {
    expect(MAX_POSTS_PER_USER).toBe(200);
  });
});

describe("ApifyPostSchema", () => {
  const validPost = {
    post_url: "https://www.threads.com/@joshproductletter/post/DWYY0vXiaTS",
    post_code: "DWYY0vXiaTS",
    text_content: "Hello Threads!",
    created_at: "2026-03-27T08:24:03+00:00",
    created_at_timestamp: 1774599843,
    like_count: 8,
    reply_count: 3,
    repost_count: 0,
    quote_count: 0,
    share_count: null,
    view_count: 200,
    has_media: false,
    media_type: "text",
    media_url: "",
    media_urls: [],
    hashtags: [],
    mentions: ["pauljo.dev"],
    urls: [],
    is_pinned: false,
    is_edited: false,
    scraped_at: "2026-03-27T08:53:15.418782+00:00",
    username: "joshproductletter",
    display_name: "Josh",
    profile_url: "https://www.threads.com/@joshproductletter",
    is_verified: false,
    followers_count: 33631,
    bio: "Builder",
    profile_pic_url: "https://scontent.cdninstagram.com/pic.jpg",
    external_links: ["https://example.com"],
    bio_links: ["https://example.com"],
  };

  it("should parse a valid post", () => {
    const result = ApifyPostSchema.parse(validPost);
    expect(result.post_code).toBe("DWYY0vXiaTS");
    expect(result.like_count).toBe(8);
    expect(result.username).toBe("joshproductletter");
  });

  it("should require post_code", () => {
    const { post_code, ...noCode } = validPost;
    expect(() => ApifyPostSchema.parse(noCode)).toThrow();
  });

  it("should require username", () => {
    const { username, ...noUsername } = validPost;
    expect(() => ApifyPostSchema.parse(noUsername)).toThrow();
  });

  it("should require created_at_timestamp", () => {
    const { created_at_timestamp, ...noTimestamp } = validPost;
    expect(() => ApifyPostSchema.parse(noTimestamp)).toThrow();
  });

  it("should default engagement counts to 0", () => {
    const { like_count, reply_count, repost_count, quote_count, ...rest } =
      validPost;
    const result = ApifyPostSchema.parse(rest);
    expect(result.like_count).toBe(0);
    expect(result.reply_count).toBe(0);
    expect(result.repost_count).toBe(0);
    expect(result.quote_count).toBe(0);
  });

  it("should default media_type to text", () => {
    const { media_type, ...rest } = validPost;
    const result = ApifyPostSchema.parse(rest);
    expect(result.media_type).toBe("text");
  });

  it("should default arrays to empty", () => {
    const { hashtags, mentions, urls, media_urls, ...rest } = validPost;
    const result = ApifyPostSchema.parse(rest);
    expect(result.hashtags).toEqual([]);
    expect(result.mentions).toEqual([]);
    expect(result.urls).toEqual([]);
    expect(result.media_urls).toEqual([]);
  });

  it("should reject negative engagement counts", () => {
    expect(() =>
      ApifyPostSchema.parse({ ...validPost, like_count: -1 })
    ).toThrow();
  });

  it("should allow null text_content", () => {
    const result = ApifyPostSchema.parse({ ...validPost, text_content: null });
    expect(result.text_content).toBeNull();
  });

  it("should parse photo media_type", () => {
    const result = ApifyPostSchema.parse({
      ...validPost,
      media_type: "photo",
    });
    expect(result.media_type).toBe("photo");
  });

  it("should allow null share_count and view_count", () => {
    const result = ApifyPostSchema.parse({
      ...validPost,
      share_count: null,
      view_count: null,
    });
    expect(result.share_count).toBeNull();
    expect(result.view_count).toBeNull();
  });

  it("should parse minimal post (only required fields)", () => {
    const minimal = {
      post_code: "ABC123",
      created_at_timestamp: 1774599843,
      username: "test",
    };
    const result = ApifyPostSchema.parse(minimal);
    expect(result.post_code).toBe("ABC123");
    expect(result.like_count).toBe(0);
    expect(result.is_verified).toBe(false);
  });
});

describe("extractProfileFromPost", () => {
  it("should extract profile data from a post item", () => {
    const post = ApifyPostSchema.parse({
      post_code: "ABC",
      created_at_timestamp: 1774599843,
      username: "JoshProductLetter",
      display_name: "Josh",
      profile_pic_url: "https://example.com/pic.jpg",
      followers_count: 33631,
      is_verified: true,
      bio: "Builder",
    });

    const profile = extractProfileFromPost(post);
    expect(profile.username).toBe("joshproductletter"); // lowercased
    expect(profile.displayName).toBe("Josh");
    expect(profile.followerCount).toBe(33631);
    expect(profile.isVerified).toBe(true);
    expect(profile.biography).toBe("Builder");
  });

  it("should handle missing optional profile fields", () => {
    const post = ApifyPostSchema.parse({
      post_code: "ABC",
      created_at_timestamp: 1774599843,
      username: "test",
    });

    const profile = extractProfileFromPost(post);
    expect(profile.displayName).toBeNull();
    expect(profile.profilePicUrl).toBeNull();
    expect(profile.followerCount).toBeNull();
    expect(profile.biography).toBeNull();
  });
});

describe("ApifyActorInputSchema", () => {
  it("should parse valid input", () => {
    const result = ApifyActorInputSchema.parse({
      usernames: ["zuck"],
      maxPosts: 50,
    });
    expect(result.maxPosts).toBe(50);
  });

  it("should default maxPosts to 200", () => {
    const result = ApifyActorInputSchema.parse({
      usernames: ["zuck"],
    });
    expect(result.maxPosts).toBe(200);
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
      actorId: "futurizerush/meta-threads-scraper",
      actorRunId: "run123",
    },
    resource: {
      id: "run123",
      actId: "futurizerush/meta-threads-scraper",
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
  it("should sum like_count + repost_count + reply_count", () => {
    const post = ApifyPostSchema.parse({
      post_code: "1",
      username: "test",
      like_count: 100,
      reply_count: 50,
      repost_count: 25,
      quote_count: 10,
      created_at_timestamp: 1234567890,
    });
    expect(calculateTotalEngagement(post)).toBe(175);
  });

  it("should NOT include quote_count in total", () => {
    const post = ApifyPostSchema.parse({
      post_code: "1",
      username: "test",
      like_count: 0,
      reply_count: 0,
      repost_count: 0,
      quote_count: 100,
      created_at_timestamp: 1234567890,
    });
    expect(calculateTotalEngagement(post)).toBe(0);
  });

  it("should return 0 for zero engagement", () => {
    const post = ApifyPostSchema.parse({
      post_code: "1",
      username: "test",
      created_at_timestamp: 1234567890,
    });
    expect(calculateTotalEngagement(post)).toBe(0);
  });
});
