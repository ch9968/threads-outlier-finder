"use client";

interface OutlierSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export function OutlierSlider({
  value,
  onChange,
  min = 2,
  max = 10,
  step = 0.5,
}: OutlierSliderProps) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="text-sm font-semibold text-primary"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {value}x+
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1.5 w-48 cursor-pointer appearance-none rounded-full bg-stone-700 accent-primary"
      />
    </div>
  );
}
