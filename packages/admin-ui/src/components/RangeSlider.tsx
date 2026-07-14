import { cn } from "../lib/cn";

export interface RangeSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
  className?: string;
}

// Net Profit / WPFOK-parity percent/threshold slider with a live large
// numeric readout. See globals.css's `.wpfok-scope`.
export function RangeSlider({ value, onChange, min = 0, max = 100, step = 1, suffix, disabled, className }: RangeSliderProps) {
  return (
    <div className={cn("flex items-center gap-3.5", disabled && "opacity-60", className)}>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-sm outline-none accent-brand-500"
        style={{ background: "linear-gradient(90deg, var(--wpfok-glow, rgba(143,0,255,.15)), var(--brand-500))" }}
      />
      <span className="num min-w-12 text-center text-lg font-extrabold text-brand-500">
        {value}
        {suffix}
      </span>
    </div>
  );
}
