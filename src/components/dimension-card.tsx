import type { HookType } from "@/lib/prompts/analysis";
import { HOOK_TYPE_LABELS } from "@/lib/prompts/analysis";

interface DimensionCardProps {
  title: string;
  content: string;
  hookType?: HookType | null;
}

export function DimensionCard({ title, content, hookType }: DimensionCardProps) {
  return (
    <div className="rounded-lg border border-stone-700 bg-stone-800 p-4">
      <h3 className="mb-2 text-sm font-semibold text-primary">{title}</h3>
      <p className="text-sm leading-relaxed text-stone-300">{content}</p>
      {hookType && (
        <span className="mt-2 inline-block rounded-full bg-stone-700 px-2.5 py-0.5 text-xs text-stone-400">
          {HOOK_TYPE_LABELS[hookType]}
        </span>
      )}
    </div>
  );
}

export function DimensionCardSkeleton({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-stone-700 bg-stone-800 p-4">
      <h3 className="mb-2 text-sm font-semibold text-primary">{title}</h3>
      <div className="space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-stone-700" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-stone-700" />
        <div className="h-3 w-3/5 animate-pulse rounded bg-stone-700" />
      </div>
    </div>
  );
}

interface MetadataCardProps {
  mediaRelevance: string | null;
  lengthAnalysis: string | null;
  timingNote: string | null;
}

export function MetadataCard({
  mediaRelevance,
  lengthAnalysis,
  timingNote,
}: MetadataCardProps) {
  const hasContent = mediaRelevance || lengthAnalysis || timingNote;
  if (!hasContent) return null;

  return (
    <div className="rounded-lg border border-stone-700 bg-stone-800 p-4">
      <h3 className="mb-2 text-sm font-semibold text-stone-400">메타데이터</h3>
      <div className="space-y-1.5 text-sm text-stone-400">
        {mediaRelevance && (
          <p>
            <span className="font-medium text-stone-300">미디어:</span>{" "}
            {mediaRelevance}
          </p>
        )}
        {lengthAnalysis && (
          <p>
            <span className="font-medium text-stone-300">길이:</span>{" "}
            {lengthAnalysis}
          </p>
        )}
        {timingNote && (
          <p>
            <span className="font-medium text-stone-300">기타:</span>{" "}
            {timingNote}
          </p>
        )}
      </div>
    </div>
  );
}
