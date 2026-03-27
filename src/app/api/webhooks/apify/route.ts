import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { fetchDatasetItems } from "@/lib/apify/client";
import {
  ApifyWebhookPayloadSchema,
  ApifyPostSchema,
  normalizeMediaType,
  extractProfileFromPost,
  type ApifyPost,
} from "@/lib/apify/schema";
import { calculateOutlierScores } from "@/lib/outlier";

/**
 * Verify the webhook secret from Apify.
 * Apify sends the secret in the request URL or headers.
 */
function verifyWebhookSecret(request: NextRequest): boolean {
  const secret = process.env.APIFY_WEBHOOK_SECRET;
  if (!secret) {
    // If no secret configured, skip verification (dev mode)
    console.warn("APIFY_WEBHOOK_SECRET not set — skipping verification");
    return true;
  }

  const providedSecret =
    request.nextUrl.searchParams.get("secret") ||
    request.headers.get("x-apify-webhook-secret");

  return providedSecret === secret;
}

export async function POST(request: NextRequest) {
  // Verify webhook secret
  if (!verifyWebhookSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse and validate payload
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = ApifyWebhookPayloadSchema.safeParse(body);

  if (!parsed.success) {
    console.error("Invalid webhook payload:", parsed.error.flatten());
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const payload = parsed.data;
  const jobId = request.nextUrl.searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  // Idempotency check: skip if job is already processed
  const { data: existingJob } = await supabase
    .from("scrape_jobs")
    .select("id, status")
    .eq("id", jobId)
    .single();

  if (!existingJob) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (existingJob.status === "ready" || existingJob.status === "failed") {
    // Already processed — idempotent response
    return NextResponse.json({ ok: true, idempotent: true });
  }

  // Handle failure events
  // ABORTED runs may have partial data — let them through to the success path
  const hasData =
    payload.eventType === "ACTOR.RUN.SUCCEEDED" ||
    payload.eventType === "ACTOR.RUN.ABORTED";

  if (!hasData) {
    const errorMessages: Record<string, string> = {
      "ACTOR.RUN.FAILED": "Scraping failed. The account may be private or not exist.",
      "ACTOR.RUN.TIMED_OUT": "Scraping timed out. Please try again.",
    };

    await supabase
      .from("scrape_jobs")
      .update({
        status: "failed",
        error_message: errorMessages[payload.eventType] || "Unknown error",
      })
      .eq("id", jobId);

    return NextResponse.json({ ok: true });
  }

  // Success path: fetch and process dataset
  try {
    const datasetId = payload.resource.defaultDatasetId;

    // Save dataset ID for debugging
    await supabase
      .from("scrape_jobs")
      .update({ dataset_id: datasetId })
      .eq("id", jobId);

    const rawItems = await fetchDatasetItems(datasetId);

    if (rawItems.length === 0) {
      await supabase
        .from("scrape_jobs")
        .update({
          status: "failed",
          error_message: "No data found. The account may be private or not exist.",
        })
        .eq("id", jobId);

      return NextResponse.json({ ok: true });
    }

    // Parse items through Zod (skip malformed rows)
    const posts: ApifyPost[] = [];

    for (const item of rawItems) {
      const result = ApifyPostSchema.safeParse(item);
      if (result.success) {
        posts.push(result.data);
      } else {
        console.warn("Skipping malformed dataset item:", result.error.flatten());
      }
    }

    if (posts.length === 0) {
      await supabase
        .from("scrape_jobs")
        .update({
          status: "failed",
          error_message: "No posts found for this account.",
        })
        .eq("id", jobId);

      return NextResponse.json({ ok: true });
    }

    // Extract profile from first post (denormalized)
    const profile = extractProfileFromPost(posts[0]);

    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .upsert(
        {
          username: profile.username,
          display_name: profile.displayName,
          profile_pic_url: profile.profilePicUrl,
          follower_count: profile.followerCount,
          is_verified: profile.isVerified,
          biography: profile.biography,
          last_scraped_at: new Date().toISOString(),
        },
        { onConflict: "username" }
      )
      .select("id")
      .single();

    if (accountError || !account) {
      console.error("Failed to upsert account:", accountError);
      await supabase
        .from("scrape_jobs")
        .update({ status: "failed", error_message: "Database error" })
        .eq("id", jobId);

      return NextResponse.json(
        { error: "Database error" },
        { status: 500 }
      );
    }

    // Batch upsert posts
    const postRows = posts.map((p) => ({
      account_id: account.id,
      apify_post_id: p.post_code,
      post_code: p.post_code,
      text_content: p.text_content ?? null,
      media_type: normalizeMediaType(p.media_type),
      like_count: p.like_count,
      repost_count: p.repost_count,
      reply_count: p.reply_count,
      quote_count: p.quote_count,
      is_reply: false,
      is_repost: false,
      posted_at: new Date(p.created_at_timestamp * 1000).toISOString(),
      raw_data: p as unknown as Record<string, unknown>,
    }));

    const { error: postsError } = await supabase
      .from("posts")
      .upsert(postRows, { onConflict: "apify_post_id" });

    if (postsError) {
      console.error("Failed to upsert posts:", postsError);
      await supabase
        .from("scrape_jobs")
        .update({ status: "failed", error_message: "Failed to save posts" })
        .eq("id", jobId);

      return NextResponse.json(
        { error: "Database error" },
        { status: 500 }
      );
    }

    // Fetch all posts for this account to calculate outlier scores
    const { data: allPosts } = await supabase
      .from("posts")
      .select("id, like_count, repost_count, reply_count, is_reply, is_repost, posted_at")
      .eq("account_id", account.id)
      .order("posted_at", { ascending: false });

    if (allPosts && allPosts.length > 0) {
      const postsForScoring = allPosts.map((p) => ({
        id: p.id,
        totalEngagement: p.like_count + p.repost_count + p.reply_count,
        isReply: p.is_reply,
        isRepost: p.is_repost,
        postedAt: new Date(p.posted_at),
      }));

      const scores = calculateOutlierScores(postsForScoring);

      const BATCH_SIZE = 25;
      for (let i = 0; i < scores.length; i += BATCH_SIZE) {
        const batch = scores.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map((score) =>
            supabase
              .from("posts")
              .update({ outlier_score: score.outlierScore })
              .eq("id", score.id)
          )
        );
      }
    }

    // Mark job as ready
    await supabase
      .from("scrape_jobs")
      .update({
        status: "ready",
        post_count: posts.length,
      })
      .eq("id", jobId);

    return NextResponse.json({ ok: true, postCount: posts.length });
  } catch (err) {
    console.error("Webhook processing error:", err);

    await supabase
      .from("scrape_jobs")
      .update({
        status: "failed",
        error_message: "Internal processing error",
      })
      .eq("id", jobId);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
