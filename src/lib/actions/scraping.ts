"use server";

import { z } from "zod";
import { supabase } from "@/lib/supabase/client";
import { startApifyRun } from "@/lib/apify/client";
import { headers } from "next/headers";

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

    // Build webhook URL
    const headerStore = await headers();
    const host = headerStore.get("host") || "localhost:3000";
    const protocol = host.startsWith("localhost") ? "http" : "https";
    const webhookUrl = `${protocol}://${host}/api/webhooks/apify?jobId=${job.id}`;

    // Start Apify run
    const run = await startApifyRun(username, webhookUrl);

    // Update job with run ID
    await supabase
      .from("scrape_jobs")
      .update({ apify_run_id: run.id, status: "scraping" })
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
