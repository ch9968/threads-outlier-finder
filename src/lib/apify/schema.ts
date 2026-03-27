import { z } from "zod";

// ---------------------------------------------------------------------------
// Actor Configuration
// ---------------------------------------------------------------------------

export const APIFY_ACTOR_ID = "automation-lab/threads-scraper";
export const MAX_POSTS_PER_USER = 200;

// ---------------------------------------------------------------------------
// Apify Actor Output Schemas
// Based on: https://apify.com/automation-lab/threads-scraper
// ---------------------------------------------------------------------------

/**
 * Profile row from the actor output dataset.
 * Returned when includeProfile is true. Identified by type: "profile".
 */
export const ApifyProfileSchema = z.object({
  type: z.literal("profile"),
  username: z.string(),
  fullName: z.string().nullable().optional(),
  biography: z.string().nullable().optional(),
  followerCount: z.number().int().nonnegative().nullable().optional(),
  isVerified: z.boolean().optional(),
  profilePicUrl: z.string().url().nullable().optional(),
  url: z.string().url().optional(),
  userId: z.string().optional(),
  scrapedAt: z.string().datetime().optional(),
});

export type ApifyProfile = z.infer<typeof ApifyProfileSchema>;

/**
 * Post row from the actor output dataset.
 * Identified by type: "post".
 */
export const ApifyPostSchema = z.object({
  type: z.literal("post"),

  // Identity
  postId: z.string(),
  code: z.string().optional(),
  url: z.string().url().optional(),

  // Author (denormalized)
  username: z.string(),
  fullName: z.string().nullable().optional(),
  isVerified: z.boolean().optional(),

  // Content
  text: z.string().nullable().optional(),
  hashtags: z.array(z.string()).default([]),
  mentions: z.array(z.string()).default([]),
  urls: z.array(z.string()).default([]),

  // Engagement metrics
  likeCount: z.number().int().nonnegative().default(0),
  replyCount: z.number().int().nonnegative().default(0),
  repostCount: z.number().int().nonnegative().default(0),
  quoteCount: z.number().int().nonnegative().default(0),

  // Media — use catch() to gracefully handle unknown types (e.g. "sticker")
  // instead of failing validation and dropping the entire post
  mediaType: z.string().catch("text"),
  media: z.array(z.unknown()).default([]),

  // Metadata
  isReply: z.boolean().default(false),
  isRepost: z.boolean().default(false),
  repostedFrom: z.string().nullable().optional(),
  timestamp: z.number(),
  date: z.string(),
  scrapedAt: z.string().datetime().optional(),
});

export type ApifyPost = z.infer<typeof ApifyPostSchema>;

/**
 * A dataset item can be either a profile row or a post row.
 * Distinguished by the `type` field.
 */
export const ApifyDatasetItemSchema = z.discriminatedUnion("type", [
  ApifyProfileSchema,
  ApifyPostSchema,
]);

export type ApifyDatasetItem = z.infer<typeof ApifyDatasetItemSchema>;

// ---------------------------------------------------------------------------
// Actor Input Schema
// ---------------------------------------------------------------------------

export const ApifyActorInputSchema = z.object({
  mode: z.enum(["profile", "posts", "search"]).default("posts"),
  usernames: z.array(z.string().min(1)).min(1),
  maxPosts: z.number().int().min(1).max(200).default(200),
  includeProfile: z.boolean().default(true),
});

export type ApifyActorInput = z.infer<typeof ApifyActorInputSchema>;

// ---------------------------------------------------------------------------
// Apify Webhook Payload Schema
// ---------------------------------------------------------------------------

/**
 * Standard Apify webhook payload for ACTOR.RUN.* events.
 * Sent as POST to our /api/webhooks/apify endpoint.
 */
export const ApifyWebhookPayloadSchema = z.object({
  userId: z.string(),
  createdAt: z.string().datetime(),
  eventType: z.enum([
    "ACTOR.RUN.SUCCEEDED",
    "ACTOR.RUN.FAILED",
    "ACTOR.RUN.ABORTED",
    "ACTOR.RUN.TIMED_OUT",
  ]),
  eventData: z.object({
    actorId: z.string(),
    actorRunId: z.string(),
  }),
  resource: z.object({
    id: z.string(),
    actId: z.string(),
    status: z.enum([
      "SUCCEEDED",
      "FAILED",
      "ABORTED",
      "TIMED-OUT",
      "RUNNING",
    ]),
    defaultDatasetId: z.string(),
    defaultKeyValueStoreId: z.string().optional(),
    startedAt: z.string().datetime().optional(),
    finishedAt: z.string().datetime().optional(),
    stats: z
      .object({
        inputBodyLen: z.number().optional(),
        restartCount: z.number().optional(),
        resurrectCount: z.number().optional(),
        datasetItemCount: z.number().int().nonnegative().optional(),
      })
      .passthrough()
      .optional(),
    options: z.record(z.unknown()).optional(),
  }),
});

export type ApifyWebhookPayload = z.infer<typeof ApifyWebhookPayloadSchema>;

// ---------------------------------------------------------------------------
// Media Type Mapping
// ---------------------------------------------------------------------------

/**
 * Map Apify mediaType to our DB media_type.
 * Apify uses "photo" while we store "image" for consistency.
 */
export function normalizeMediaType(
  apifyMediaType: string | undefined
): "text" | "image" | "carousel" | "video" {
  switch (apifyMediaType) {
    case "photo":
      return "image";
    case "carousel":
      return "carousel";
    case "video":
      return "video";
    default:
      return "text";
  }
}

// ---------------------------------------------------------------------------
// Engagement Calculation
// ---------------------------------------------------------------------------

/**
 * Calculate total engagement from Apify post metrics.
 * Matches the DB formula: like_count + repost_count + reply_count
 */
export function calculateTotalEngagement(post: ApifyPost): number {
  return post.likeCount + post.repostCount + post.replyCount;
}
