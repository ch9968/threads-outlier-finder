import { cn } from "@/lib/cn";

interface PostCardProps {
  outlierScore: number | null;
  textContent: string | null;
  likeCount: number;
  repostCount: number;
  replyCount: number;
  mediaType: string;
  isReply: boolean;
  isRepost: boolean;
  postCode: string | null;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function PostCard({
  outlierScore,
  textContent,
  likeCount,
  repostCount,
  replyCount,
  mediaType,
  isReply,
  isRepost,
  postCode,
}: PostCardProps) {
  const threadUrl = postCode
    ? `https://www.threads.com/t/${postCode}`
    : null;

  return (
    <div className="group grid grid-cols-[80px_1fr_auto] items-center gap-4 rounded-lg border border-stone-700 bg-stone-800 px-4 py-3 transition-colors duration-150 hover:border-stone-600">
      {/* Outlier score */}
      <div className="text-right">
        {outlierScore !== null ? (
          <span
            className={cn(
              "text-2xl font-bold",
              outlierScore >= 5 ? "text-primary" : "text-stone-300"
            )}
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {outlierScore.toFixed(1)}x
          </span>
        ) : (
          <span className="text-sm text-stone-500">
            {isRepost ? "repost" : isReply ? "reply" : "—"}
          </span>
        )}
      </div>

      {/* Text content */}
      <div className="min-w-0">
        <p className="line-clamp-2 text-sm text-stone-300">
          {textContent || (
            <span className="italic text-stone-500">No text content</span>
          )}
        </p>
        <div className="mt-1 flex items-center gap-2">
          {mediaType !== "text" && (
            <span className="rounded-full bg-stone-700 px-2 py-0.5 text-xs text-stone-400">
              {mediaType}
            </span>
          )}
          {threadUrl && (
            <a
              href={threadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-stone-500 hover:text-primary"
            >
              view
            </a>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div
        className="flex gap-3 text-xs text-stone-400"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        <span title="Likes">{formatNumber(likeCount)}</span>
        <span title="Reposts">{formatNumber(repostCount)}</span>
        <span title="Replies">{formatNumber(replyCount)}</span>
      </div>
    </div>
  );
}
