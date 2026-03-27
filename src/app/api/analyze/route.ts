import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase/client";
import { getGenerativeModel } from "@/lib/vertex-ai/client";
import {
  buildAnalysisPrompt,
  parseAnalysisResponse,
} from "@/lib/prompts/analysis";

const RequestSchema = z.object({
  postId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid postId" }, { status: 400 });
  }

  const { postId } = parsed.data;

  // Check cache first
  const { data: existing } = await supabase
    .from("analyses")
    .select(
      "hook_analysis, emotion_analysis, structure_analysis, cta_analysis, conversation_analysis, sharing_analysis, hook_type, metadata_analysis, full_response"
    )
    .eq("post_id", postId)
    .single();

  if (existing) {
    return NextResponse.json({ cached: true, analysis: existing });
  }

  // Fetch post + account data for prompt
  const { data: post, error: postError } = await supabase
    .from("posts")
    .select(
      "id, text_content, media_type, like_count, repost_count, reply_count, outlier_score, account_id"
    )
    .eq("id", postId)
    .single();

  if (postError || !post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("username")
    .eq("id", post.account_id)
    .single();

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Build prompt
  const prompt = buildAnalysisPrompt({
    textContent: post.text_content,
    mediaType: post.media_type,
    likeCount: post.like_count,
    repostCount: post.repost_count,
    replyCount: post.reply_count,
    outlierScore: post.outlier_score,
    username: account.username,
  });

  // Stream from Vertex AI
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

        // Only cache if response has meaningful content (all 6 dimensions present)
        const analysis = parseAnalysisResponse(fullText);
        const hasContent = analysis.hook || analysis.emotion || analysis.structure ||
          analysis.cta || analysis.conversation || analysis.sharing;

        if (hasContent) {
          const { error: insertError } = await supabase
            .from("analyses")
            .upsert(
              {
                post_id: postId,
                hook_analysis: analysis.hook,
                emotion_analysis: analysis.emotion,
                structure_analysis: analysis.structure,
                cta_analysis: analysis.cta,
                conversation_analysis: analysis.conversation,
                sharing_analysis: analysis.sharing,
                hook_type: analysis.hookType,
                metadata_analysis: analysis.metadata,
                full_response: fullText,
              },
              { onConflict: "post_id" }
            );

          if (insertError) {
            console.error("Failed to save analysis:", insertError);
          }
        } else {
          console.warn("Skipping cache: LLM response was empty or incomplete");
        }

        controller.close();
      } catch (err) {
        console.error("Analysis streaming error:", err);
        // Send error marker so client knows something went wrong
        controller.enqueue(
          encoder.encode("\n\n[ERROR] Analysis failed. Please try again.")
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
