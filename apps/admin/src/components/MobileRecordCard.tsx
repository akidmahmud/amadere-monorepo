"use client";

import type { ReactNode } from "react";

/**
 * One row of a wide admin table, rendered as a card for phones.
 *
 * The Order Manager table is declared `minWidth: 1600` and the other two are
 * not far off. On a 390px screen that is not a table you scroll, it is a
 * table you cannot read: the pinned first column eats a third of the width
 * and every value worth seeing is off to the right. Horizontal scrolling is
 * technically "responsive" and practically useless.
 *
 * So below `md` the table is replaced outright by a list of these, each
 * showing the handful of fields that actually decide what someone does next,
 * and tapping one opens the same detail modal the desktop row does. The table
 * is untouched above `md` — it is genuinely good on a desktop and staff know
 * its column order.
 */
export function MobileRecordCard({
  title,
  subtitle,
  badge,
  fields,
  actions,
  onClick,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Status pill, top-right — the one thing scanned before anything else. */
  badge?: ReactNode;
  /** Label/value pairs. A null or empty value is dropped rather than shown
   *  as a blank row, so short records stay short. */
  fields: { label: string; value: ReactNode }[];
  /** Buttons along the bottom. Their own clicks must not open the card. */
  actions?: ReactNode;
  onClick?: () => void;
}) {
  const shown = fields.filter(
    (f) => f.value !== null && f.value !== undefined && f.value !== "",
  );

  return (
    <div className="rounded-card border border-border bg-surface p-3.5 shadow-card">
      {/* A div, not a button: these cards carry selects and links inside, and
          a button cannot legally contain either. Click is handled here and
          the interactive children stop propagation themselves. */}
      <div
        onClick={onClick}
        className={onClick ? "cursor-pointer" : undefined}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClick();
                }
              }
            : undefined
        }
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-ui text-sm font-bold text-text">{title}</div>
            {subtitle ? (
              <div className="mt-0.5 truncate text-xs text-muted">{subtitle}</div>
            ) : null}
          </div>
          {badge ? <div className="shrink-0">{badge}</div> : null}
        </div>

        {shown.length > 0 && (
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
            {shown.map((f) => (
              <div key={f.label} className="min-w-0">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  {f.label}
                </dt>
                <dd className="mt-0.5 truncate text-sm text-text">{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {actions ? (
        <div
          className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3"
          // Stops a tap on a button inside from also opening the card.
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}
