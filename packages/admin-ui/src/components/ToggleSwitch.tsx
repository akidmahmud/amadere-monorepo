import { cn } from "../lib/cn";

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

// Net Profit / WPFOK-parity boolean switch — used for feature-enable
// toggles instead of a plain checkbox. See globals.css's `.wpfok-scope`.
export function ToggleSwitch({ checked, onChange, disabled, label, className }: ToggleSwitchProps) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2.5", disabled && "cursor-not-allowed opacity-60", className)}>
      <span className="relative inline-block h-[26px] w-12 flex-none">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer absolute h-0 w-0 opacity-0"
        />
        <span
          className={cn(
            "absolute inset-0 rounded-pill transition-colors duration-150",
            checked ? "bg-brand-500" : "bg-border",
          )}
          style={checked ? { boxShadow: "0 0 12px var(--wpfok-glow, rgba(143,0,255,.3))" } : undefined}
        />
        <span
          className={cn(
            "absolute top-[3px] h-5 w-5 rounded-full bg-white shadow-card transition-transform duration-150",
            checked ? "left-[25px]" : "left-[3px]",
          )}
        />
      </span>
      {label && <span className="font-ui text-sm text-text">{label}</span>}
    </label>
  );
}
