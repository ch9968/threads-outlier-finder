"use client";

import { useState, useEffect, useCallback } from "react";
import { pollApifyRun } from "@/lib/actions/scraping";
import { toggleCollectionItem } from "@/lib/actions/collection";
import { OutlierSlider } from "./outlier-slider";
import { PostCard } from "./post-card";

interface Post {
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
}

interface ResultsClientProps {
  username: string;
  initialStatus: string;
  initialPosts: Post[];
  initialErrorMessage: string | null;
  isSmallSample: boolean;
  initialCollectedPostIds: string[];
}

const POLL_INTERVAL = 3000;

export function ResultsClient({
  username,
  initialStatus,
  initialPosts,
  initialErrorMessage,
  isSmallSample,
  initialCollectedPostIds,
}: ResultsClientProps) {
  const [status, setStatus] = useState(initialStatus);
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [errorMessage, setErrorMessage] = useState(initialErrorMessage);
  const [threshold, setThreshold] = useState(2);
  const [collectedPostIds, setCollectedPostIds] = useState<Set<string>>(
    new Set(initialCollectedPostIds)
  );

  const poll = useCallback(async () => {
    const result = await pollApifyRun(username);
    if (result.data) {
      setStatus(result.data.status);
      if (result.data.errorMessage) {
        setErrorMessage(result.data.errorMessage);
      }
      // If status changed to ready, reload the page to get fresh data
      if (result.data.status === "ready" && status !== "ready") {
        window.location.reload();
      }
    }
  }, [username, status]);

  useEffect(() => {
    if (status === "pending" || status === "scraping") {
      const interval = setInterval(poll, POLL_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [status, poll]);

  const handleToggleCollection = useCallback(async (postId: string) => {
    // Optimistic update
    setCollectedPostIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });

    const result = await toggleCollectionItem(postId);

    if (result.error) {
      // Revert on error
      setCollectedPostIds((prev) => {
        const next = new Set(prev);
        if (next.has(postId)) {
          next.delete(postId);
        } else {
          next.add(postId);
        }
        return next;
      });
    }
  }, []);

  // Filter posts by threshold
  const filteredPosts = posts.filter(
    (p) => p.outlier_score !== null && p.outlier_score >= threshold
  );

  const totalOriginalPosts = posts.filter(
    (p) => !p.is_reply && !p.is_repost
  ).length;

  // Track elapsed time for loading state
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (status === "pending" || status === "scraping") {
      const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
      return () => clearInterval(timer);
    }
  }, [status]);

  // Loading state
  if (status === "pending" || status === "scraping") {
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const timeStr = minutes > 0
      ? `${minutes}:${seconds.toString().padStart(2, "0")}`
      : `${seconds}s`;

    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-stone-600 border-t-primary" />
        <p className="text-sm text-stone-400">
          Analyzing @{username}...
        </p>
        <p
          className="mt-1 text-xs text-stone-500"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {timeStr} elapsed
        </p>
        {elapsed > 60 && (
          <p className="mt-1 text-xs text-stone-600">
            Large accounts may take a few minutes
          </p>
        )}
      </div>
    );
  }

  // Error state
  if (status === "failed") {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <p className="mb-2 text-sm text-error">
          {errorMessage || "Analysis failed"}
        </p>
        <a
          href="/"
          className="mt-4 rounded-md border border-stone-700 px-4 py-2 text-sm text-stone-300 transition-colors duration-150 hover:border-stone-500"
        >
          Try again
        </a>
      </div>
    );
  }

  // Results
  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-stone-100">
            Outliers
            <span
              className="ml-2 text-sm font-normal text-stone-400"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {filteredPosts.length}/{totalOriginalPosts}
            </span>
          </h2>
          {isSmallSample && (
            <p className="mt-1 text-xs text-stone-500">
              Based on overall average (fewer than 11 original posts)
            </p>
          )}
        </div>
        <OutlierSlider value={threshold} onChange={setThreshold} />
      </div>

      {/* Post list */}
      {filteredPosts.length === 0 ? (
        <p className="py-12 text-center text-sm text-stone-500">
          No posts above {threshold}x threshold. Try lowering the slider.
        </p>
      ) : (
        <div className="space-y-2">
          {filteredPosts
            .sort((a, b) => (b.outlier_score ?? 0) - (a.outlier_score ?? 0))
            .map((post) => (
              <PostCard
                key={post.id}
                postId={post.id}
                outlierScore={post.outlier_score}
                textContent={post.text_content}
                likeCount={post.like_count}
                repostCount={post.repost_count}
                replyCount={post.reply_count}
                mediaType={post.media_type}
                isReply={post.is_reply}
                isRepost={post.is_repost}
                postCode={post.post_code}
                isCollected={collectedPostIds.has(post.id)}
                onToggleCollection={handleToggleCollection}
              />
            ))}
        </div>
      )}
    </div>
  );
}
