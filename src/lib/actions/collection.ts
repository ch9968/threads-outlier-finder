"use server";

import { z } from "zod";
import { supabase } from "@/lib/supabase/client";

const PostIdSchema = z.string().uuid("Invalid post ID");

interface ToggleResult {
  data: { isCollected: boolean } | null;
  error: string | null;
}

/**
 * Toggle a post in/out of the collection.
 * If the post is already collected, remove it. Otherwise, add it.
 */
export async function toggleCollectionItem(
  postId: string
): Promise<ToggleResult> {
  try {
    const parsed = PostIdSchema.safeParse(postId);
    if (!parsed.success) {
      return { data: null, error: parsed.error.errors[0].message };
    }

    // Check if already in collection — distinguish "not found" (PGRST116) from real errors
    const { data: existing, error: selectError } = await supabase
      .from("collection_items")
      .select("id")
      .eq("post_id", parsed.data)
      .single();

    if (selectError && selectError.code !== "PGRST116") {
      console.error("Failed to check collection:", selectError);
      return { data: null, error: "Failed to update collection" };
    }

    if (existing) {
      // Remove from collection
      const { error: deleteError } = await supabase
        .from("collection_items")
        .delete()
        .eq("post_id", parsed.data);

      if (deleteError) {
        console.error("Failed to remove from collection:", deleteError);
        return { data: null, error: "Failed to remove from collection" };
      }

      return { data: { isCollected: false }, error: null };
    }

    // Add to collection — UNIQUE constraint on post_id guards against race conditions
    const { error: insertError } = await supabase
      .from("collection_items")
      .insert({ post_id: parsed.data });

    if (insertError) {
      // Handle race condition: if another request already inserted, treat as "already collected"
      if (insertError.code === "23505") {
        return { data: { isCollected: true }, error: null };
      }
      console.error("Failed to add to collection:", insertError);
      return { data: null, error: "Failed to add to collection" };
    }

    return { data: { isCollected: true }, error: null };
  } catch (err) {
    console.error("toggleCollectionItem error:", err);
    return { data: null, error: "Failed to update collection" };
  }
}

interface RemoveResult {
  data: { removed: boolean } | null;
  error: string | null;
}

/**
 * Explicitly remove a post from the collection.
 */
export async function removeFromCollection(
  postId: string
): Promise<RemoveResult> {
  try {
    const parsed = PostIdSchema.safeParse(postId);
    if (!parsed.success) {
      return { data: null, error: parsed.error.errors[0].message };
    }

    const { error: deleteError } = await supabase
      .from("collection_items")
      .delete()
      .eq("post_id", parsed.data);

    if (deleteError) {
      console.error("Failed to remove from collection:", deleteError);
      return { data: null, error: "Failed to remove from collection" };
    }

    return { data: { removed: true }, error: null };
  } catch (err) {
    console.error("removeFromCollection error:", err);
    return { data: null, error: "Failed to remove from collection" };
  }
}

/**
 * Get all post IDs currently in the collection.
 * Used to hydrate the initial collection state on the results page.
 */
export async function getCollectionPostIds(): Promise<{
  data: string[] | null;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from("collection_items")
      .select("post_id");

    if (error) {
      console.error("Failed to fetch collection:", error);
      return { data: null, error: "Failed to fetch collection" };
    }

    return {
      data: data.map((item) => item.post_id),
      error: null,
    };
  } catch (err) {
    console.error("getCollectionPostIds error:", err);
    return { data: null, error: "Failed to fetch collection" };
  }
}
