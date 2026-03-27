"use client";

import { useState, useCallback } from "react";
import {
  parsePatternResponse,
  type PatternCard as PatternCardType,
} from "@/lib/prompts/pattern";
import { PatternCard, PatternCardSkeleton } from "./pattern-card";

interface PatternStreamProps {
  cachedPatterns: PatternCardType[] | null;
  itemCount: number;
}

export function PatternStream({
  cachedPatterns,
  itemCount,
}: PatternStreamProps) {
  const [patterns, setPatterns] = useState<PatternCardType[] | null>(
    cachedPatterns
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    setError(null);
    setPatterns(null);

    try {
      const res = await fetch("/api/pattern-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        setError(errBody?.error || "Pattern analysis request failed");
        setIsAnalyzing(false);
        return;
      }

      // Cached response (JSON)
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const json = await res.json();
        setPatterns(json.patterns);
        setIsAnalyzing(false);
        return;
      }

      // Streaming response — accumulate full text then parse
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
      }

      if (accumulated.includes("[ERROR]")) {
        setError("Pattern analysis failed. Please try again.");
        setIsAnalyzing(false);
        return;
      }

      const { patterns: parsed, error: parseError } =
        parsePatternResponse(accumulated);

      if (parseError) {
        setError(parseError);
      } else {
        setPatterns(parsed);
      }

      setIsAnalyzing(false);
    } catch (err) {
      console.error("Pattern stream error:", err);
      setError("Failed to connect to analysis service");
      setIsAnalyzing(false);
    }
  }, []);

  return (
    <div>
      {/* Analyze button */}
      {!patterns && !isAnalyzing && (
        <div className="mb-6 flex flex-col items-center gap-3 py-8">
          <p className="text-sm text-stone-400">
            {itemCount} posts in collection. Find recurring success patterns.
          </p>
          <button
            onClick={runAnalysis}
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-stone-950 transition-colors duration-150 hover:bg-primary-hover"
          >
            Analyze Patterns
          </button>
        </div>
      )}

      {/* Loading state */}
      {isAnalyzing && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            <span className="text-sm text-stone-400">
              Analyzing patterns across {itemCount} posts...
            </span>
          </div>
          <PatternCardSkeleton />
          <PatternCardSkeleton />
          <PatternCardSkeleton />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-error/30 bg-error/5 p-6 text-center">
          <p className="text-sm text-error">{error}</p>
          <button
            onClick={runAnalysis}
            className="mt-3 rounded-md border border-stone-700 px-4 py-2 text-sm text-stone-300 transition-colors duration-150 hover:border-stone-500"
          >
            Try again
          </button>
        </div>
      )}

      {/* Results */}
      {patterns && patterns.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-stone-100">
              Patterns Found
            </h2>
            <button
              onClick={runAnalysis}
              className="text-xs text-stone-500 transition-colors duration-150 hover:text-stone-300"
            >
              Re-analyze
            </button>
          </div>
          {patterns.map((pattern, i) => (
            <PatternCard key={i} pattern={pattern} />
          ))}
        </div>
      )}

      {patterns && patterns.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-sm text-stone-500">
            No recurring patterns found. Try adding more diverse posts to your
            collection.
          </p>
          <button
            onClick={runAnalysis}
            className="mt-3 text-xs text-stone-500 transition-colors duration-150 hover:text-stone-300"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
