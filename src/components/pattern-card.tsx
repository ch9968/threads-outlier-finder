import { cn } from "@/lib/cn";
import type { PatternCard as PatternCardType } from "@/lib/prompts/pattern";

interface PatternCardProps {
  pattern: PatternCardType;
}

export function PatternCard({ pattern }: PatternCardProps) {
  return (
    <div className="rounded-lg border border-stone-700 bg-stone-800 p-5">
      {/* Header: name + frequency badge */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-primary">
          {pattern.name}
        </h3>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className="rounded-full bg-primary-subtle px-2.5 py-0.5 text-xs font-medium text-primary"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {pattern.avgOutlierScore.toFixed(1)}x avg
          </span>
          <span
            className="rounded-full bg-stone-700 px-2.5 py-0.5 text-xs text-stone-400"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {pattern.frequency} posts
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="mb-4 text-sm leading-relaxed text-stone-300">
        {pattern.description}
      </p>

      {/* Evidence */}
      <div className="mb-4 space-y-2">
        <h4 className="text-xs font-medium uppercase tracking-wider text-stone-500">
          Evidence
        </h4>
        {pattern.evidence.map((ev, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-md bg-stone-900 px-3 py-2"
          >
            <span
              className={cn(
                "shrink-0 text-sm font-bold",
                ev.outlierScore >= 5 ? "text-primary" : "text-stone-300"
              )}
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {ev.outlierScore.toFixed(1)}x
            </span>
            <div className="min-w-0">
              <span className="text-xs text-stone-500">{ev.account}</span>
              <p className="truncate text-sm text-stone-400">
                {ev.postSnippet}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Action Guide */}
      <div className="rounded-md border border-stone-700 bg-stone-900 p-3">
        <h4 className="mb-1 text-xs font-medium uppercase tracking-wider text-stone-500">
          How to apply
        </h4>
        <p className="text-sm leading-relaxed text-stone-300">
          {pattern.actionGuide}
        </p>
      </div>
    </div>
  );
}

export function PatternCardSkeleton() {
  return (
    <div className="rounded-lg border border-stone-700 bg-stone-800 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="h-5 w-40 animate-pulse rounded bg-stone-700" />
        <div className="flex gap-2">
          <div className="h-5 w-16 animate-pulse rounded-full bg-stone-700" />
          <div className="h-5 w-16 animate-pulse rounded-full bg-stone-700" />
        </div>
      </div>
      <div className="mb-4 space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-stone-700" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-stone-700" />
      </div>
      <div className="mb-4 space-y-2">
        <div className="h-3 w-16 animate-pulse rounded bg-stone-700" />
        <div className="h-10 w-full animate-pulse rounded-md bg-stone-900" />
        <div className="h-10 w-full animate-pulse rounded-md bg-stone-900" />
      </div>
      <div className="h-16 w-full animate-pulse rounded-md bg-stone-900" />
    </div>
  );
}
