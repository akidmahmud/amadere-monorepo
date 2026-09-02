"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "../lib/cn";

export interface AutocompleteOption {
  /** The value stored on the form. */
  value: string;
  /** Extra strings that should also match — codes, abbreviations, a Bengali
   *  spelling. Never shown as the value, only searched. */
  aliases?: string[];
  /** Small line under the value in the list. */
  hint?: string;
}

/** exact → prefix → contains. Lower is better; MISS means drop it. */
const MISS = 999;

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[\s._-]+/g, "");
}

function rank(option: AutocompleteOption, query: string): number {
  const q = normalize(query);
  if (!q) return 0;
  let best = MISS;
  for (const candidate of [option.value, ...(option.aliases ?? [])]) {
    const c = normalize(candidate);
    if (c === q) best = Math.min(best, 0);
    else if (c.startsWith(q)) best = Math.min(best, 1);
    else if (c.includes(q)) best = Math.min(best, 2);
  }
  return best;
}

/**
 * Type-to-search field with a suggestion list.
 *
 * Deliberately NOT built on Radix Select. A Select is a listbox: on a phone it
 * fights the virtual keyboard (Radix dismisses an open Select on the resize the
 * keyboard causes — the bug that made district unpickable on mobile checkout),
 * and it cannot accept a value that is not in the list. This is a plain text
 * input, so the keyboard is expected rather than fatal, and a district with no
 * curated area list degrades to ordinary free text with no separate code path.
 *
 * Selection is committed on `mousedown`/`touchstart` rather than `click`,
 * because the input's own `blur` fires first and would close the list out from
 * under the tap.
 */
export function Autocomplete({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  id,
  /** Allow a value that matches no option. True for address fields, where the
   *  list is a convenience and the customer's own spelling must still submit. */
  allowFreeText = true,
  emptyMessage = "No matches",
  maxResults = 12,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: AutocompleteOption[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  allowFreeText?: boolean;
  emptyMessage?: ReactNode;
  maxResults?: number;
  className?: string;
  "aria-label"?: string;
}) {
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // null query = showing the committed value; a string = the customer is typing.
  const text = query ?? value;

  const matches = useMemo(() => {
    const scored = options
      .map((option) => ({ option, r: rank(option, text) }))
      .filter((x) => x.r < MISS);
    // Stable within a rank, so the list does not reshuffle as you type.
    scored.sort((a, b) => a.r - b.r);
    return scored.slice(0, maxResults).map((x) => x.option);
  }, [options, text, maxResults]);

  function commit(next: string) {
    onChange(next);
    setQuery(null);
    setOpen(false);
  }

  return (
    <div className={cn("relative", className)}>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        autoComplete="off"
        disabled={disabled}
        value={text}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlighted(0);
          setOpen(true);
          // Free-text fields keep the form in step with what is typed, so a
          // customer who never picks a suggestion still submits what they wrote.
          if (allowFreeText) onChange(e.target.value);
        }}
        onBlur={() => {
          // A tick, so a mousedown on a suggestion wins the race.
          blurTimer.current = setTimeout(() => {
            setOpen(false);
            setQuery(null);
          }, 120);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setHighlighted((h) => Math.min(h + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlighted((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter" && open && matches[highlighted]) {
            e.preventDefault();
            commit(matches[highlighted].value);
          } else if (e.key === "Escape") {
            setOpen(false);
            setQuery(null);
          }
        }}
        className="w-full rounded-[10px] border border-line bg-white px-3.5 py-2.5 font-body text-sm text-ink outline-none focus:border-green disabled:cursor-not-allowed disabled:bg-cream disabled:opacity-60"
      />

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-[10px] border border-line bg-white shadow-brand">
          {matches.length === 0 && (
            <p className="px-3 py-3 text-center font-body text-sm text-muted">{emptyMessage}</p>
          )}
          {matches.map((option, index) => (
            <button
              key={option.value}
              type="button"
              // Beats the input's blur; touchstart so a tap does not wait for
              // the browser's synthesised click.
              onMouseDown={(e) => {
                e.preventDefault();
                if (blurTimer.current) clearTimeout(blurTimer.current);
                commit(option.value);
              }}
              onTouchStart={() => {
                if (blurTimer.current) clearTimeout(blurTimer.current);
                commit(option.value);
              }}
              onMouseEnter={() => setHighlighted(index)}
              className={cn(
                "block w-full cursor-pointer border-b border-line px-3.5 py-2.5 text-left font-body text-sm text-ink last:border-b-0",
                index === highlighted && "bg-cream",
              )}
            >
              <span className="block">{option.value}</span>
              {option.hint && (
                <span className="mt-0.5 block text-xs text-muted">{option.hint}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
