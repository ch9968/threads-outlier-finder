"use client";

import { useState, useEffect } from "react";
import {
  extractSections,
  parseAnalysisResponse,
  DIMENSION_KEYS,
  DIMENSION_LABELS,
  SECTION_TO_KEY,
  type ParsedAnalysis,
} from "@/lib/prompts/analysis";
import { DimensionCard, DimensionCardSkeleton, MetadataCard } from "./dimension-card";

interface AnalysisStreamProps {
  postId: string;
}

export function AnalysisStream({ postId }: AnalysisStreamProps) {
  const [streamedText, setStreamedText] = useState("");
  const [isStreaming, setIsStreaming] = useState(true);
  const [parsed, setParsed] = useState<ParsedAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function runAnalysis() {
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          setError(errBody?.error || "Analysis request failed");
          setIsStreaming(false);
          return;
        }

        // Cached response (JSON)
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const json = await res.json();
          setParsed({
            hook: json.analysis.hook_analysis,
            emotion: json.analysis.emotion_analysis,
            structure: json.analysis.structure_analysis,
            cta: json.analysis.cta_analysis,
            conversation: json.analysis.conversation_analysis,
            sharing: json.analysis.sharing_analysis,
            hookType: json.analysis.hook_type,
            metadata: json.analysis.metadata_analysis || {
              mediaRelevance: null,
              lengthAnalysis: null,
              timingNote: null,
            },
          });
          setIsStreaming(false);
          return;
        }

        // Streaming response
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          accumulated += decoder.decode(value, { stream: true });
          setStreamedText(accumulated);
        }

        // Check for error marker
        if (accumulated.includes("[ERROR]")) {
          setError("Analysis failed. Please try again.");
          setIsStreaming(false);
          return;
        }

        // Parse completed response
        const result = parseAnalysisResponse(accumulated);
        setParsed(result);
        setIsStreaming(false);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Analysis stream error:", err);
        setError("Failed to connect to analysis service");
        setIsStreaming(false);
      }
    }

    runAnalysis();
    return () => controller.abort();
  }, [postId]);

  // Error state
  if (error) {
    return (
      <div className="rounded-lg border border-error/30 bg-error/5 p-6 text-center">
        <p className="text-sm text-error">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 rounded-md border border-stone-700 px-4 py-2 text-sm text-stone-300 transition-colors duration-150 hover:border-stone-500"
        >
          Try again
        </button>
      </div>
    );
  }

  // Completed analysis
  if (parsed && !isStreaming) {
    return (
      <div className="space-y-3">
        {DIMENSION_KEYS.map((key) => (
          <DimensionCard
            key={key}
            title={DIMENSION_LABELS[key]}
            content={parsed[key]}
            hookType={key === "hook" ? parsed.hookType : undefined}
          />
        ))}
        <MetadataCard
          mediaRelevance={parsed.metadata.mediaRelevance}
          lengthAnalysis={parsed.metadata.lengthAnalysis}
          timingNote={parsed.metadata.timingNote}
        />
      </div>
    );
  }

  // Streaming — show dimension cards progressively
  const partialSections = extractSections(streamedText);
  const partialParsed = parseAnalysisResponse(streamedText);

  return (
    <div className="space-y-3">
      {DIMENSION_KEYS.map((key) => {
        const sectionName = Object.entries(SECTION_TO_KEY).find(
          ([, v]) => v === key
        )?.[0];

        const content = sectionName ? partialSections[sectionName] : undefined;

        if (content) {
          return (
            <DimensionCard
              key={key}
              title={DIMENSION_LABELS[key]}
              content={content}
              hookType={
                key === "hook" ? partialParsed.hookType : undefined
              }
            />
          );
        }

        return (
          <DimensionCardSkeleton key={key} title={DIMENSION_LABELS[key]} />
        );
      })}
    </div>
  );
}
