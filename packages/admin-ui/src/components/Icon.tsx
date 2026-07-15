import { cn } from "../lib/cn";

export interface IconProps {
  /** A Material Symbols icon name, e.g. "dashboard", "local_shipping". */
  name: string;
  className?: string;
  /** Font size in px — most call sites can omit this; wrapper components
   * (IconTile/NavItem/SettingsCard) size it down to 20px via CSS, and it
   * otherwise defaults to 24px to match this icon set's usual footprint. */
  size?: number;
  fill?: boolean;
}

// Material Symbols (Google's icon font) rendered via ligature text, not an
// <svg> — one <link> in the root layout loads the whole set, so any icon
// name works everywhere without adding a per-icon asset. `fill`/weight are
// the variable font's own axes (no separate "filled" icon needed).
export function Icon({ name, className, size = 24, fill = false }: IconProps) {
  return (
    <span
      className={cn("material-symbols-outlined select-none leading-none", className)}
      style={{ fontSize: size, fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24` }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
