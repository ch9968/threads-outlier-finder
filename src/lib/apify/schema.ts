import { z } from "zod";

// ---------------------------------------------------------------------------
// Actor Configuration
// ---------------------------------------------------------------------------

export const APIFY_ACTOR_ID = "thenetaji/threads-scraper";
export const MAX_POSTS_PER_USER = 200;

// ---------------------------------------------------------------------------
// Apify Actor Output Schema
// Based on actual API response from thenetaji/threads-scraper (Yw6anyCFnZlDgxUxe)
// Each item wraps a thread + profile object.
// ---------------------------------------------------------------------------

/**
 * Single dataset item from the actor output.
 */
export const ApifyPostSchema = z.object({
  type: z.string().optional(),
  thread: z.object({
    pk: z.string().optional(),
    code: z.string(),
    caption: z
      .object({ text: z.string() })
      .nullable()
      .optional(),

    // Unix timestamp (seconds)
    taken_at: z.number().int().positive(),

    // Engagement metrics — null coerced to 0 (actor returns null for some posts)
    like_count: z.preprocess((v) => v ?? 0, z.number().int().nonnegative()),
    like_and_view_counts_disabled: z.boolean().default(false),

    // Instagram media_type enum: 1=image, 2=video, 8=carousel, 19=text-only
    media_type: z.preprocess((v) => v ?? 19, z.number().int()),

    image_versions2: z
      .object({
        candidates: z
          .array(
            z.object({
              url: z.string(),
              width: z.number().optional(),
              height: z.number().optional(),
            })
          )
          .default([]),
      })
      .nullable()
      .optional(),

    video_versions: z
      .array(z.object({ url: z.string() }).passthrough())
      .nullable()
      .optional(),

    carousel_media: z.array(z.unknown()).nullable().optional(),
    audio: z.unknown().nullable().optional(),

    user: z.object({
      pk: z.string().optional(),
      username: z.string(),
      full_name: z.string().nullable().optional(),
      is_verified: z.boolean().default(false),
      profile_pic_url: z.string().nullable().optional(),
    }),

    text_post_app_info: z.object({
      direct_reply_count: z.preprocess((v) => v ?? 0, z.number().int().nonnegative()),
      repost_count: z.preprocess((v) => v ?? 0, z.number().int().nonnegative()),
      quote_count: z.preprocess((v) => v ?? 0, z.number().int().nonnegative()),
      reshare_count: z.preprocess((v) => v ?? 0, z.number().int().nonnegative()),
      is_reply: z.boolean().default(false),
      reply_to_author: z.unknown().nullable().optional(),
    }),
  }),

  threadIndex: z.number().optional(),
  sourceUrl: z.string().optional(),

  profile: z
    .object({
      pk: z.string().optional(),
      username: z.string(),
      full_name: z.string().nullable().optional(),
      is_verified: z.boolean().default(false),
    })
    .optional(),
});

export type ApifyPost = z.infer<typeof ApifyPostSchema>;

// ---------------------------------------------------------------------------
// Profile extraction helper
// ---------------------------------------------------------------------------

export interface ExtractedProfile {
  username: string;
  displayName: string | null;
  profilePicUrl: string | null;
  followerCount: number | null;
  isVerified: boolean;
  biography: string | null;
}

export function extractProfileFromPost(post: ApifyPost): ExtractedProfile {
  const user = post.thread.user;
  return {
    username: user.username.toLowerCase(),
    displayName: user.full_name ?? null,
    profilePicUrl: user.profile_pic_url ?? null,
    followerCount: null,
    isVerified: user.is_verified,
    biography: null,
  };
}

// ---------------------------------------------------------------------------
// Actor Input Schema
// ---------------------------------------------------------------------------

export const ApifyActorInputSchema = z.object({
  input: z.array(z.object({ url: z.string() })),
  maxThreads: z.number().int().min(0).max(200).default(MAX_POSTS_PER_USER),
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
 * Map Instagram media_type integer to our DB enum.
 * 1 = image, 2 = video, 8 = carousel/sidecar, 19 = text-only post
 */
export function normalizeMediaType(
  mediaType: number
): "text" | "image" | "carousel" | "video" {
  switch (mediaType) {
    case 1:
      return "image";
    case 2:
      return "video";
    case 8:
      return "carousel";
    default:
      return "text";
  }
}

// ---------------------------------------------------------------------------
// Engagement Calculation
// ---------------------------------------------------------------------------

/**
 * Calculate total engagement from Apify post metrics.
 * Matches the DB formula: like_count + repost_count + direct_reply_count
 */
export function calculateTotalEngagement(post: ApifyPost): number {
  const tpa = post.thread.text_post_app_info;
  return post.thread.like_count + tpa.repost_count + tpa.direct_reply_count;
}

/**
 * Parse taken_at unix timestamp (seconds) to ISO 8601.
 */
export function parseTakenAt(takenAt: number): string {
  const date = new Date(takenAt * 1000);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid taken_at timestamp: ${takenAt}`);
  }
  return date.toISOString();
}
