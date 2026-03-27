"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { removeFromCollection } from "@/lib/actions/collection";
import { PostCard } from "./post-card";
import { CollectionFilter } from "./collection-filter";

interface CollectionPost {
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
  username: string;
}

interface CollectionClientProps {
  initialPosts: CollectionPost[];
}

export function CollectionClient({ initialPosts }: CollectionClientProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

  // Unique accounts from the current posts
  const accounts = [...new Set(posts.map((p) => p.username))].sort();

  const handleRemove = useCallback(async (postId: string) => {
    // Optimistic removal
    setPosts((prev) => prev.filter((p) => p.id !== postId));

    const result = await removeFromCollection(postId);

    if (result.error) {
      // Revert on error — re-fetch would be cleaner but initialPosts is stale
      // So we just add it back from the initial data
      setPosts((prev) => {
        const removed = initialPosts.find((p) => p.id === postId);
        if (removed && !prev.some((p) => p.id === postId)) {
          return [...prev, removed].sort(
            (a, b) => (b.outlier_score ?? 0) - (a.outlier_score ?? 0)
          );
        }
        return prev;
      });
    }
  }, [initialPosts]);

  // Reset filter if selected account has no posts left
  useEffect(() => {
    if (selectedAccount && !posts.some((p) => p.username === selectedAccount)) {
      setSelectedAccount(null);
    }
  }, [posts, selectedAccount]);

  const filteredPosts = useMemo(() => {
    const filtered = selectedAccount
      ? posts.filter((p) => p.username === selectedAccount)
      : posts;
    return [...filtered].sort(
      (a, b) => (b.outlier_score ?? 0) - (a.outlier_score ?? 0)
    );
  }, [posts, selectedAccount]);

  return (
    <div>
      {/* Filter chips */}
      <div className="mb-6">
        <CollectionFilter
          accounts={accounts}
          selected={selectedAccount}
          onSelect={setSelectedAccount}
        />
      </div>

      {/* Post count */}
      <div className="mb-4">
        <span
          className="text-sm text-stone-400"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {filteredPosts.length} {filteredPosts.length === 1 ? "item" : "items"}
        </span>
      </div>

      {/* Posts grid */}
      {filteredPosts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <p className="text-sm text-stone-500">
            {posts.length === 0
              ? "Your collection is empty. Save outlier posts from the results page."
              : "No items match this filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredPosts.map((post) => (
              <PostCard
                key={post.id}
                id={post.id}
                outlierScore={post.outlier_score}
                textContent={post.text_content}
                likeCount={post.like_count}
                repostCount={post.repost_count}
                replyCount={post.reply_count}
                mediaType={post.media_type}
                isReply={post.is_reply}
                isRepost={post.is_repost}
                postCode={post.post_code}
                isCollected
                onToggleCollection={handleRemove}
              />
            ))}
        </div>
      )}
    </div>
  );
}
