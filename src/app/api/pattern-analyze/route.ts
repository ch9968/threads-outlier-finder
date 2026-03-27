import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { getGenerativeModel } from "@/lib/vertex-ai/client";
import {
  buildPatternPrompt,
  parsePatternResponse,
  type PatternInput,
} from "@/lib/prompts/pattern";

export async function POST() {
  // Fetch collection items with joined post + account + analysis data
  const { data: collectionItems, error: queryError } = await supabase
    .from("collection_items")
    .select(`
      post_id,
      posts (
        id,
        text_content,
        outlier_score,
        account_id,
        accounts (
          username
        )
      )
    `)
    .order("created_at", { ascending: false });

  if (queryError) {
    console.error("Failed to fetch collection:", queryError);
    return NextResponse.json(
      { error: "Failed to fetch collection" },
      { status: 500 }
    );
  }

  if (!collectionItems || collectionItems.length === 0) {
    return NextResponse.json(
      { error: "Collection is empty" },
      { status: 400 }
    );
  }

  if (collectionItems.length < 3) {
    return NextResponse.json(
      { error: "Need at least 3 items for pattern analysis" },
      { status: 400 }
    );
  }

  // Extract post IDs for analysis lookup
  const postIds = collectionItems
    .filter((item) => item.posts && !Array.isArray(item.posts))
    .map((item) => {
      const post = item.posts as unknown as { id: string };
      return post.id;
    });

  // Fetch analyses for these posts (if Phase 2 data exists)
  const { data: analyses } = await supabase
    .from("analyses")
    .select("post_id, hook_type, hook_analysis")
    .in("post_id", postIds);

  const analysisMap = new Map(
    (analyses ?? []).map((a) => [a.post_id, a])
  );

  // Build prompt input
  const posts: PatternInput["posts"] = collectionItems
    .filter((item) => item.posts && !Array.isArray(item.posts))
    .map((item) => {
      const post = item.posts as unknown as {
        id: string;
        text_content: string | null;
        outlier_score: number | null;
        accounts: { username: string } | null;
      };
      const analysis = analysisMap.get(post.id);

      return {
        account: post.accounts?.username ?? "unknown",
        textContent: post.text_content,
        outlierScore: post.outlier_score ?? 0,
        hookType: analysis?.hook_type ?? null,
        hookAnalysis: analysis?.hook_analysis ?? null,
      };
    })
    .filter((p) => p.outlierScore > 0);

  if (posts.length < 3) {
    return NextResponse.json(
      { error: "Not enough scored posts for pattern analysis" },
      { status: 400 }
    );
  }

  // Always generate fresh analysis from LLM (no route-level cache).
  // Page-level cache in collection/page.tsx handles showing cached results
  // on initial page load. The route is only called when the user explicitly
  // clicks "Analyze Patterns" or "Re-analyze".

  const prompt = buildPatternPrompt({ posts });

  let model;
  let result;
  try {
    model = getGenerativeModel();
    result = await model.generateContentStream({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
  } catch (err) {
    console.error("Vertex AI initialization error:", err);
    return NextResponse.json(
      { error: "Analysis service unavailable" },
      { status: 503 }
    );
  }

  const encoder = new TextEncoder();
  let fullText = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.stream) {
          const text =
            chunk.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          fullText += text;
          controller.enqueue(encoder.encode(text));
        }

        // Parse and cache result
        const { patterns, error: parseError } =
          parsePatternResponse(fullText);

        if (parseError) {
          console.error("Pattern parse error:", parseError);
        }

        if (patterns.length > 0) {
          const { error: insertError } = await supabase
            .from("pattern_analyses")
            .insert({
              item_count: posts.length,
              patterns: patterns,
              full_response: fullText,
            });

          if (insertError) {
            console.error("Failed to cache pattern analysis:", insertError);
          }
        } else {
          console.warn(
            "Skipping cache: no valid patterns parsed from LLM response"
          );
        }

        controller.close();
      } catch (err) {
        console.error("Pattern analysis streaming error:", err);
        controller.enqueue(
          encoder.encode(
            "\n\n[ERROR] Pattern analysis failed. Please try again."
          )
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
