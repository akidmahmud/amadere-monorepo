"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";

export interface QtyStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  className?: string;
  /**
   * Debounces the actual onChange call by this many ms after the last
   * +/- click — the displayed number still updates instantly on every
   * click, only the callback (typically a network mutation) is coalesced,
   * so rapid clicking doesn't fire one request per click. 0 (default) means
   * every click calls onChange immediately, matching the original behavior
   * — opt in per call site that actually has a slow/networked onChange
   * (e.g. the cart drawer); a purely local onChange (e.g. the PDP's "qty to
   * add" stepper) doesn't need it. Typed edits (the number itself) always
   * commit immediately regardless of this — it's one deliberate action, not
   * a burst of clicks.
   */
  commitDelayMs?: number;
}

export function QtyStepper({
  value,
  onChange,
  min = 1,
  max,
  disabled,
  className,
  commitDelayMs = 0,
}: QtyStepperProps) {
  // Instant local echo — the +/- buttons and typed edits update this
  // immediately, regardless of how long the real onChange (often a network
  // mutation) takes to actually resolve. Without this, every click waited
  // for the parent's `value` prop to come back around through a full
  // mutate-then-refetch cycle before the number on screen moved at all.
  const [displayValue, setDisplayValue] = useState(value);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(String(value));
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The single source of truth for "what the +/- buttons compute from" —
  // React can batch several rapid clicks' state updates into one render, so
  // reading `displayValue` (a closure over the last *rendered* value) inside
  // two back-to-back click handlers would have both compute from the same
  // stale number and only net out to +1 instead of +2. A ref updates
  // synchronously on every click regardless of batching, so each click
  // always builds on the true latest value.
  const currentRef = useRef(value);
  // True from the moment a change is scheduled until the caller's `value`
  // prop actually catches up — prevents the external-sync effect below from
  // snapping the display back to a stale value while a debounced commit (or
  // its network round trip) is still in flight.
  const pendingRef = useRef(false);

  useEffect(() => {
    if (value === currentRef.current) pendingRef.current = false;
    if (!editing && !pendingRef.current) {
      currentRef.current = value;
      setDisplayValue(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => () => {
    if (commitTimer.current) clearTimeout(commitTimer.current);
  }, []);

  function clamp(v: number): number {
    let next = Math.max(min, Math.trunc(v));
    if (max !== undefined) next = Math.min(max, next);
    return next;
  }

  function scheduleCommit(delta: number) {
    const next = clamp(currentRef.current + delta);
    currentRef.current = next;
    setDisplayValue(next);
    pendingRef.current = true;
    if (commitTimer.current) clearTimeout(commitTimer.current);
    if (commitDelayMs <= 0) {
      onChange(next);
      return;
    }
    commitTimer.current = setTimeout(() => onChange(next), commitDelayMs);
  }

  const canDecrement = !disabled && displayValue > min;
  const canIncrement = !disabled && (max === undefined || displayValue < max);

  function startEditing() {
    if (disabled) return;
    setEditText(String(displayValue));
    setEditing(true);
  }

  function commitEdit() {
    setEditing(false);
    const parsed = Number(editText);
    if (editText.trim() === "" || !Number.isFinite(parsed)) return;
    const next = clamp(parsed);
    if (commitTimer.current) clearTimeout(commitTimer.current);
    currentRef.current = next;
    setDisplayValue(next);
    if (next === value) {
      pendingRef.current = false;
      return;
    }
    pendingRef.current = true;
    onChange(next);
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-[#eef0f3] p-1",
        className,
      )}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={!canDecrement}
        onClick={() => scheduleCommit(-1)}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-base text-[#8a94a3] disabled:opacity-40"
      >
        –
      </button>
      {editing ? (
        <input
          type="number"
          inputMode="numeric"
          autoFocus
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitEdit();
            } else if (e.key === "Escape") {
              setEditing(false);
            }
          }}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-[32px] max-w-[52px] rounded-full border border-[#2f5fdb]/40 bg-white text-center font-ui text-sm font-semibold text-[#2f5fdb] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={startEditing}
          aria-label="Edit quantity"
          className="min-w-[22px] text-center font-ui text-sm font-semibold text-[#2f5fdb] disabled:opacity-70"
        >
          {displayValue}
        </button>
      )}
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={!canIncrement}
        onClick={() => scheduleCommit(1)}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-base text-[#8a94a3] disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}
