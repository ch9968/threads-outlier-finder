import { supabase } from "@/lib/supabase/client";
import { isSmallSampleBaseline } from "@/lib/outlier";
import { ResultsClient } from "@/components/results-client";
import Link from "next/link";

interface PageProps {
  params: Promise<{ username: string }>;
}

export default async function ResultsPage({ params }: PageProps) {
  const { username } = await params;
  const normalizedUsername = username.toLowerCase();

  // Get latest job for this username
  const { data: job } = await supabase
    .from("scrape_jobs")
    .select("id, status, error_message, post_count")
    .eq("username", normalizedUsername)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!job) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-stone-950">
        <p className="mb-4 text-sm text-stone-400">
          No analysis found for @{normalizedUsername}
        </p>
        <Link
          href="/"
          className="rounded-md border border-stone-700 px-4 py-2 text-sm text-stone-300 transition-colors duration-150 hover:border-stone-500"
        >
          Go back
        </Link>
      </div>
    );
  }

  // Fetch posts if job is ready
  let posts: Array<{
    id: string;
    outlier_score: number | null;
    text_content: string | null;
    like_count: number;
    repost_count: number;
    reply_count: number;
    media_type: string;
    is_reply: boolean;
    is_repost: boolean;
    post_code: string | null;
  }> = [];

  let smallSample = false;
  let collectedPostIds: string[] = [];

  if (job.status === "ready") {
    const { data: account } = await supabase
      .from("accounts")
      .select("id")
      .eq("username", normalizedUsername)
      .single();

    if (account) {
      const [postsResult, collectionResult] = await Promise.all([
        supabase
          .from("posts")
          .select(
            "id, outlier_score, text_content, like_count, repost_count, reply_count, media_type, is_reply, is_repost, post_code, posted_at"
          )
          .eq("account_id", account.id)
          .order("outlier_score", { ascending: false, nullsFirst: false }),
        supabase
          .from("collection_items")
          .select("post_id, posts!inner(account_id)")
          .eq("posts.account_id", account.id),
      ]);

      if (postsResult.data) {
        posts = postsResult.data;

        // Check if small sample baseline was used
        smallSample = isSmallSampleBaseline(
          postsResult.data.map((p) => ({
            id: p.id,
            totalEngagement: p.like_count + p.repost_count + p.reply_count,
            isReply: p.is_reply,
            isRepost: p.is_repost,
            postedAt: new Date(p.posted_at),
          }))
        );
      }

      if (collectionResult.error) {
        console.error("Failed to fetch collection state:", collectionResult.error);
      } else if (collectionResult.data) {
        collectedPostIds = collectionResult.data.map((item) => item.post_id);
      }
    }
  }

  return (
    <div className="min-h-screen bg-stone-950">
      <div className="mx-auto max-w-3xl px-6 py-8">
        {/* Navigation */}
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-stone-500 transition-colors duration-150 hover:text-stone-300"
          >
            &larr; Back
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/collection"
              className="text-sm text-stone-500 transition-colors duration-150 hover:text-stone-300"
            >
              Collection
            </Link>
            <h1
              className="text-lg font-bold tracking-tight text-stone-100"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Santiago
            </h1>
          </div>
        </div>

        {/* Account header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-stone-100">
            @{normalizedUsername}
          </h1>
          {job.post_count != null && job.post_count > 0 && (
            <p
              className="mt-1 text-sm text-stone-400"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {job.post_count} posts analyzed
            </p>
          )}
        </div>

        {/* Results */}
        <ResultsClient
          username={normalizedUsername}
          initialStatus={job.status}
          initialPosts={posts}
          initialErrorMessage={job.error_message}
          isSmallSample={smallSample}
          initialCollectedPostIds={collectedPostIds}
        />
      </div>
    </div>
  );
}
