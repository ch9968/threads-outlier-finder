"use server";

import { z } from "zod";
import { supabase } from "@/lib/supabase/client";
import { startApifyRun, getApifyRunStatus, fetchDatasetItems } from "@/lib/apify/client";
import {
  ApifyPostSchema,
  normalizeMediaType,
  extractProfileFromPost,
  type ApifyPost,
} from "@/lib/apify/schema";
import { calculateOutlierScores } from "@/lib/outlier";

const COOLDOWN_HOURS = 1;

const UsernameSchema = z
  .string()
  .min(1, "Username is required")
  .max(30)
  .regex(/^[a-zA-Z0-9._]+$/, "Invalid username format");

interface StartScrapingResult {
  data: { jobId: string; isExisting: boolean } | null;
  error: string | null;
}

/**
 * Start scraping for a Threads username.
 * Returns existing data if:
 * - A job is already in progress (pending/scraping)
 * - Account was scraped within the cooldown period
 */
export async function startScraping(
  formData: FormData
): Promise<StartScrapingResult> {
  try {
    const rawUsername = formData.get("username");
    const parsed = UsernameSchema.safeParse(rawUsername);

    if (!parsed.success) {
      return { data: null, error: parsed.error.errors[0].message };
    }

    const username = parsed.data.toLowerCase();

    // Check for in-progress job
    const { data: activeJob } = await supabase
      .from("scrape_jobs")
      .select("id, status")
      .eq("username", username)
      .in("status", ["pending", "scraping"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (activeJob) {
      return {
        data: { jobId: activeJob.id, isExisting: true },
        error: null,
      };
    }

    // Check cooldown
    const { data: account } = await supabase
      .from("accounts")
      .select("last_scraped_at")
      .eq("username", username)
      .single();

    if (account?.last_scraped_at) {
      const lastScraped = new Date(account.last_scraped_at);
      const cooldownEnd = new Date(
        lastScraped.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000
      );

      if (new Date() < cooldownEnd) {
        // Return the latest completed job
        const { data: latestJob } = await supabase
          .from("scrape_jobs")
          .select("id")
          .eq("username", username)
          .eq("status", "ready")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (latestJob) {
          return {
            data: { jobId: latestJob.id, isExisting: true },
            error: null,
          };
        }
      }
    }

    // Create new job
    const { data: job, error: insertError } = await supabase
      .from("scrape_jobs")
      .insert({ username, status: "pending" })
      .select("id")
      .single();

    if (insertError || !job) {
      console.error("Failed to create scrape job:", insertError);
      return { data: null, error: "Failed to start analysis" };
    }

    // Start Apify run (polling-based, no webhook needed)
    let run;
    try {
      run = await startApifyRun(username);
    } catch (apifyErr) {
      // Clean up the pending job so it doesn't block future requests
      await supabase
        .from("scrape_jobs")
        .update({ status: "failed", error_message: "Failed to start scraping service" })
        .eq("id", job.id);

      console.error("startApifyRun error:", apifyErr);
      return { data: null, error: "Failed to start analysis. Please try again." };
    }

    // Update job with run ID and dataset ID
    await supabase
      .from("scrape_jobs")
      .update({
        apify_run_id: run.id,
        dataset_id: run.datasetId,
        status: "scraping",
      })
      .eq("id", job.id);

    return {
      data: { jobId: job.id, isExisting: false },
      error: null,
    };
  } catch (err) {
    console.error("startScraping error:", err);
    return { data: null, error: "Failed to start analysis. Please try again." };
  }
}

/**
 * Convert parsed Apify posts into DB row format.
 */
function toPostRows(posts: ApifyPost[], accountId: string) {
  return posts.map((p) => ({
    account_id: accountId,
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
}

/**
 * Poll Apify run status and process data when complete.
 * Called from the client on an interval while job is in progress.
 * Returns the updated job status after checking Apify.
 */
export async function pollApifyRun(username: string): Promise<{
  data: {
    status: string;
    errorMessage: string | null;
    postCount: number | null;
  } | null;
  error: string | null;
}> {
  try {
    const parsed = UsernameSchema.safeParse(username);
    if (!parsed.success) {
      return { data: null, error: "Invalid username" };
    }

    const { data: job } = await supabase
      .from("scrape_jobs")
      .select("id, status, apify_run_id, dataset_id")
      .eq("username", parsed.data.toLowerCase())
      .in("status", ["pending", "scraping"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!job || !job.apify_run_id) {
      // No active job or no run ID yet — return current DB status
      return await getJobStatus(parsed.data.toLowerCase());
    }

    // Check Apify run status
    const apifyStatus = await getApifyRunStatus(job.apify_run_id);

    if (
      apifyStatus.status === "RUNNING" ||
      apifyStatus.status === "READY" ||
      apifyStatus.status === "ABORTING"
    ) {
      return {
        data: { status: "scraping", errorMessage: null, postCount: null },
        error: null,
      };
    }

    // ABORTED runs may still have partial data — treat as success if dataset has items
    const hasData = apifyStatus.status === "SUCCEEDED" || apifyStatus.status === "ABORTED";

    if (!hasData) {
      const errorMessages: Record<string, string> = {
        FAILED: "Scraping failed. The account may be private or not exist.",
        "TIMED-OUT": "Scraping timed out. Please try again.",
      };

      const errorMsg = errorMessages[apifyStatus.status] || "Unknown error";
      await supabase
        .from("scrape_jobs")
        .update({ status: "failed", error_message: errorMsg })
        .eq("id", job.id);

      return {
        data: { status: "failed", errorMessage: errorMsg, postCount: null },
        error: null,
      };
    }

    // SUCCEEDED — fetch and process dataset
    const datasetId = job.dataset_id || apifyStatus.datasetId;
    const rawItems = await fetchDatasetItems(datasetId);

    if (rawItems.length === 0) {
      await supabase
        .from("scrape_jobs")
        .update({
          status: "failed",
          error_message: "No data found. The account may be private or not exist.",
        })
        .eq("id", job.id);

      return {
        data: {
          status: "failed",
          errorMessage: "No data found. The account may be private or not exist.",
          postCount: null,
        },
        error: null,
      };
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
        .eq("id", job.id);

      return {
        data: {
          status: "failed",
          errorMessage: "No posts found for this account.",
          postCount: null,
        },
        error: null,
      };
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
        .eq("id", job.id);

      return {
        data: { status: "failed", errorMessage: "Database error", postCount: null },
        error: null,
      };
    }

    // Batch upsert posts
    const postRows = toPostRows(posts, account.id);

    const { error: postsError } = await supabase
      .from("posts")
      .upsert(postRows, { onConflict: "apify_post_id" });

    if (postsError) {
      console.error("Failed to upsert posts:", postsError);
      await supabase
        .from("scrape_jobs")
        .update({ status: "failed", error_message: "Failed to save posts" })
        .eq("id", job.id);

      return {
        data: { status: "failed", errorMessage: "Failed to save posts", postCount: null },
        error: null,
      };
    }

    // Calculate outlier scores
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
      .update({ status: "ready", post_count: posts.length })
      .eq("id", job.id);

    return {
      data: { status: "ready", errorMessage: null, postCount: posts.length },
      error: null,
    };
  } catch (err) {
    console.error("pollApifyRun error:", err);
    return { data: null, error: "Failed to check run status" };
  }
}

/**
 * Get the current status of a scrape job for polling.
 */
export async function getJobStatus(username: string): Promise<{
  data: {
    id: string;
    status: string;
    errorMessage: string | null;
    postCount: number | null;
  } | null;
  error: string | null;
}> {
  try {
    const parsed = UsernameSchema.safeParse(username);
    if (!parsed.success) {
      return { data: null, error: "Invalid username" };
    }

    const { data: job, error } = await supabase
      .from("scrape_jobs")
      .select("id, status, error_message, post_count")
      .eq("username", parsed.data.toLowerCase())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !job) {
      return { data: null, error: "No job found for this username" };
    }

    return {
      data: {
        id: job.id,
        status: job.status,
        errorMessage: job.error_message,
        postCount: job.post_count,
      },
      error: null,
    };
  } catch (err) {
    console.error("getJobStatus error:", err);
    return { data: null, error: "Failed to check status" };
  }
}
