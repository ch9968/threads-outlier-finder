import { z } from "zod";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import {
  DIMENSION_KEYS,
  DIMENSION_LABELS,
  type HookType,
} from "@/lib/prompts/analysis";
import { DimensionCard, MetadataCard } from "@/components/dimension-card";
import { AnalysisStream } from "@/components/analysis-stream";
import Link from "next/link";
import { cn } from "@/lib/cn";

interface PageProps {
  params: Promise<{ postId: string }>;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export default async function AnalysisPage({ params }: PageProps) {
  const { postId: rawPostId } = await params;
  const postIdResult = z.string().uuid().safeParse(rawPostId);
  if (!postIdResult.success) return notFound();
  const postId = postIdResult.data;

  // Fetch post + account
  const { data: post } = await supabase
    .from("posts")
    .select(
      "id, text_content, media_type, like_count, repost_count, reply_count, outlier_score, post_code, posted_at, account_id"
    )
    .eq("id", postId)
    .single();

  if (!post) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-stone-950">
        <p className="mb-4 text-sm text-stone-400">Post not found</p>
        <Link
          href="/"
          className="rounded-md border border-stone-700 px-4 py-2 text-sm text-stone-300 transition-colors duration-150 hover:border-stone-500"
        >
          Go home
        </Link>
      </div>
    );
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("username, display_name")
    .eq("id", post.account_id)
    .single();

  const username = account?.username || "unknown";

  // Check for cached analysis
  const { data: analysis } = await supabase
    .from("analyses")
    .select(
      "hook_analysis, emotion_analysis, structure_analysis, cta_analysis, conversation_analysis, sharing_analysis, hook_type, metadata_analysis"
    )
    .eq("post_id", postId)
    .single();

  const threadUrl = post.post_code
    ? `https://www.threads.com/t/${post.post_code}`
    : null;

  // Map DB fields to dimension keys for cached rendering
  const cachedAnalysis = analysis
    ? {
        hook: analysis.hook_analysis as string,
        emotion: analysis.emotion_analysis as string,
        structure: analysis.structure_analysis as string,
        cta: analysis.cta_analysis as string,
        conversation: analysis.conversation_analysis as string,
        sharing: analysis.sharing_analysis as string,
        hookType: analysis.hook_type as HookType | null,
        metadata: (analysis.metadata_analysis as {
          mediaRelevance: string | null;
          lengthAnalysis: string | null;
          timingNote: string | null;
        }) || { mediaRelevance: null, lengthAnalysis: null, timingNote: null },
      }
    : null;

  return (
    <div className="min-h-screen bg-stone-950">
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Navigation */}
        <div className="mb-8 flex items-center justify-between">
          <Link
            href={`/results/${username}`}
            className="text-sm text-stone-500 transition-colors duration-150 hover:text-stone-300"
          >
            &larr; Back to results
          </Link>
          <h1
            className="text-lg font-bold tracking-tight text-stone-100"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Santiago
          </h1>
        </div>

        {/* Two-column layout: post + analysis */}
        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
          {/* Left: Post detail */}
          <div>
            <div className="rounded-lg border border-stone-700 bg-stone-800 p-5">
              {/* Account */}
              <div className="mb-3 flex items-center gap-2">
                <span className="text-sm font-medium text-stone-300">
                  @{username}
                </span>
                {threadUrl && (
                  <a
                    href={threadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-stone-500 hover:text-primary"
                  >
                    view on Threads
                  </a>
                )}
              </div>

              {/* Outlier score */}
              {post.outlier_score !== null && (
                <div className="mb-3">
                  <span
                    className={cn(
                      "text-3xl font-bold",
                      post.outlier_score >= 5
                        ? "text-primary"
                        : "text-stone-300"
                    )}
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {post.outlier_score.toFixed(1)}x
                  </span>
                  <span className="ml-2 text-xs text-stone-500">
                    outlier score
                  </span>
                </div>
              )}

              {/* Post text */}
              <p className="mb-4 whitespace-pre-wrap text-sm leading-relaxed text-stone-200">
                {post.text_content || (
                  <span className="italic text-stone-500">
                    No text content
                  </span>
                )}
              </p>

              {/* Media badge */}
              {post.media_type !== "text" && (
                <span className="mb-3 inline-block rounded-full bg-stone-700 px-2.5 py-0.5 text-xs text-stone-400">
                  {post.media_type}
                </span>
              )}

              {/* Metrics */}
              <div
                className="flex gap-4 border-t border-stone-700 pt-3 text-xs text-stone-400"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                <span>{formatNumber(post.like_count)} likes</span>
                <span>{formatNumber(post.repost_count)} reposts</span>
                <span>{formatNumber(post.reply_count)} replies</span>
              </div>
            </div>
          </div>

          {/* Right: Analysis */}
          <div>
            <h2 className="mb-4 text-lg font-semibold text-stone-100">
              6-Dimension Analysis
            </h2>

            {cachedAnalysis ? (
              <div className="space-y-3">
                {DIMENSION_KEYS.map((key) => (
                  <DimensionCard
                    key={key}
                    title={DIMENSION_LABELS[key]}
                    content={cachedAnalysis[key]}
                    hookType={
                      key === "hook" ? cachedAnalysis.hookType : undefined
                    }
                  />
                ))}
                <MetadataCard
                  mediaRelevance={cachedAnalysis.metadata.mediaRelevance}
                  lengthAnalysis={cachedAnalysis.metadata.lengthAnalysis}
                  timingNote={cachedAnalysis.metadata.timingNote}
                />
              </div>
            ) : (
              <AnalysisStream postId={postId} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
