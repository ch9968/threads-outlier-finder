import { z } from "zod";

// ---------------------------------------------------------------------------
// Actor Configuration
// ---------------------------------------------------------------------------

export const APIFY_ACTOR_ID = "futurizerush/meta-threads-scraper";
export const MAX_POSTS_PER_USER = 200;

// ---------------------------------------------------------------------------
// Apify Actor Output Schema
// Based on actual API response from futurizerush/meta-threads-scraper
// Profile data is denormalized into every post item (no separate profile rows)
// ---------------------------------------------------------------------------

/**
 * Single dataset item from the actor output.
 * Each item is a post with profile data embedded.
 */
export const ApifyPostSchema = z.object({
  // Post identity
  post_url: z.string().optional(),
  post_code: z.string(),
  text_content: z.string().nullable().optional(),

  // Timestamps
  created_at: z.string().optional(),
  created_at_timestamp: z.number(),

  // Engagement metrics
  like_count: z.number().int().nonnegative().default(0),
  reply_count: z.number().int().nonnegative().default(0),
  repost_count: z.number().int().nonnegative().default(0),
  quote_count: z.number().int().nonnegative().default(0),
  share_count: z.number().nullable().optional(),
  view_count: z.number().nullable().optional(),

  // Media
  has_media: z.boolean().default(false),
  media_type: z.string().catch("text"),
  media_url: z.string().optional(),
  media_urls: z.array(z.string()).default([]),

  // Content metadata
  hashtags: z.array(z.string()).default([]),
  mentions: z.array(z.string()).default([]),
  urls: z.array(z.string()).default([]),
  is_pinned: z.boolean().default(false),
  is_edited: z.boolean().default(false),

  // Denormalized profile data
  username: z.string(),
  display_name: z.string().nullable().optional(),
  profile_url: z.string().optional(),
  is_verified: z.boolean().default(false),
  followers_count: z.number().int().nonnegative().nullable().optional(),
  bio: z.string().nullable().optional(),
  profile_pic_url: z.string().nullable().optional(),
  external_links: z.array(z.string()).default([]),
  bio_links: z.array(z.string()).default([]),

  // Scraping metadata
  scraped_at: z.string().optional(),
});

export type ApifyPost = z.infer<typeof ApifyPostSchema>;

// ---------------------------------------------------------------------------
// Profile extraction helper
// ---------------------------------------------------------------------------

/**
 * Profile data extracted from the first post item.
 * The new actor embeds profile data in every post, so we extract once.
 */
export interface ExtractedProfile {
  username: string;
  displayName: string | null;
  profilePicUrl: string | null;
  followerCount: number | null;
  isVerified: boolean;
  biography: string | null;
}

export function extractProfileFromPost(post: ApifyPost): ExtractedProfile {
  return {
    username: post.username.toLowerCase(),
    displayName: post.display_name ?? null,
    profilePicUrl: post.profile_pic_url ?? null,
    followerCount: post.followers_count ?? null,
    isVerified: post.is_verified,
    biography: post.bio ?? null,
  };
}

// ---------------------------------------------------------------------------
// Actor Input Schema
// ---------------------------------------------------------------------------

export const ApifyActorInputSchema = z.object({
  usernames: z.array(z.string().min(1)).min(1),
  maxPosts: z.number().int().min(1).max(200).default(200),
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
 * The new actor uses "photo" for images.
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
  return post.like_count + post.repost_count + post.reply_count;
}
