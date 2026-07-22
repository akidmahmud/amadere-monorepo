"use client";

export interface PriceRangeSliderProps {
  min: number;
  max: number;
  valueMin: number;
  valueMax: number;
  /** Fires on every value change while dragging — React aliases both `onChange` and
   *  `onInput` to the native `input` event for range inputs, so there's no separate
   *  "on release" DOM event to hook here; the caller debounces if it needs to. */
  onChange: (min: number, max: number) => void;
  step?: number;
  currencySymbol?: string;
}

// Two native <input type="range"> stacked on the same track, each thumb only
// pointer-interactive over its own handle (via the thumb pseudo-element
// re-enabling pointer-events on an otherwise pointer-events-none input) — the
// standard dependency-free dual-range technique, no drag math needed.
export function PriceRangeSlider({
  min,
  max,
  valueMin,
  valueMax,
  onChange,
  step = 10,
  currencySymbol = "৳",
}: PriceRangeSliderProps) {
  const span = Math.max(1, max - min);
  const leftPct = ((valueMin - min) / span) * 100;
  const rightPct = ((valueMax - min) / span) * 100;

  function handleMinInput(next: number) {
    onChange(Math.min(next, valueMax), valueMax);
  }
  function handleMaxInput(next: number) {
    onChange(valueMin, Math.max(next, valueMin));
  }

  const thumbClass =
    "pointer-events-none absolute inset-0 h-1 w-full cursor-pointer appearance-none bg-transparent " +
    "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 " +
    "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-green " +
    "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md " +
    "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 " +
    "[&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-green " +
    "[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow-md";

  return (
    <div>
      <div className="relative h-4">
        <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-line" />
        <div
          className="absolute top-1/4 h-1 -translate-y-1/2 rounded-full bg-green"
          style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={valueMin}
          onChange={(e) => handleMinInput(Number(e.currentTarget.value))}
          className={thumbClass}
          aria-label="Minimum price"
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={valueMax}
          onChange={(e) => handleMaxInput(Number(e.currentTarget.value))}
          className={thumbClass}
          aria-label="Maximum price"
        />
      </div>
      <div className="mt-3 flex items-center justify-between font-body text-xs text-ink">
        <span>
          {currencySymbol}
          {valueMin}
        </span>
        <span>
          {currencySymbol}
          {valueMax}
        </span>
      </div>
    </div>
  );
}
