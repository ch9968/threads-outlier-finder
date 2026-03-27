import { supabase } from "@/lib/supabase/client";
import { CollectionClient } from "@/components/collection-client";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CollectionPage() {
  // Fetch collection items with joined post and account data
  const { data: collectionItems, error: queryError } = await supabase
    .from("collection_items")
    .select(`
      post_id,
      posts (
        id,
        outlier_score,
        text_content,
        like_count,
        repost_count,
        reply_count,
        media_type,
        is_reply,
        is_repost,
        post_code,
        accounts (
          username
        )
      )
    `)
    .order("created_at", { ascending: false });

  if (queryError) {
    console.error("Failed to fetch collection:", queryError);
  }

  // Transform the joined data into a flat structure
  const posts = (collectionItems ?? [])
    .filter((item) => item.posts && !Array.isArray(item.posts))
    .map((item) => {
      // Supabase returns single relations as object, not array
      const post = item.posts as unknown as {
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
        accounts: { username: string } | null;
      };

      return {
        id: post.id,
        outlier_score: post.outlier_score,
        text_content: post.text_content,
        like_count: post.like_count,
        repost_count: post.repost_count,
        reply_count: post.reply_count,
        media_type: post.media_type,
        is_reply: post.is_reply,
        is_repost: post.is_repost,
        post_code: post.post_code,
        username: post.accounts?.username ?? "unknown",
      };
    });

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
          <span
            className="text-lg font-bold tracking-tight text-stone-100"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Santiago
          </span>
        </div>

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-stone-100">Collection</h1>
          <p className="mt-1 text-sm text-stone-400">
            Saved outlier posts for pattern analysis
          </p>
        </div>

        {/* Collection content */}
        <CollectionClient initialPosts={posts} />
      </div>
    </div>
  );
}
