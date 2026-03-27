"use client";

import { cn } from "@/lib/cn";

interface CollectionFilterProps {
  accounts: string[];
  selected: string | null;
  onSelect: (account: string | null) => void;
}

export function CollectionFilter({
  accounts,
  selected,
  onSelect,
}: CollectionFilterProps) {
  if (accounts.length <= 1) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "rounded-full border px-3 py-1 text-xs transition-colors duration-150",
          selected === null
            ? "border-primary bg-primary-subtle text-primary"
            : "border-stone-700 text-stone-400 hover:border-stone-500"
        )}
      >
        All
      </button>
      {accounts.map((account) => (
        <button
          key={account}
          type="button"
          onClick={() => onSelect(account === selected ? null : account)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs transition-colors duration-150",
            selected === account
              ? "border-primary bg-primary-subtle text-primary"
              : "border-stone-700 text-stone-400 hover:border-stone-500"
          )}
        >
          @{account}
        </button>
      ))}
    </div>
  );
}
