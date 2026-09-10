"use client";

import { Icon } from "@amader/admin-ui";

/**
 * Page stepper for the wholesale dashboards.
 *
 * Deliberately prev/next plus a count rather than numbered page links: the
 * server returns a total but no page map, and the tables are read
 * front-to-back (newest orders, alphabetical buyers) rather than jumped
 * around in.
 *
 * Renders nothing at all when everything already fits on one page.
 */
export function Pager({
  page,
  pageSize,
  total,
  onPage,
  noun,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  /** Plural, e.g. "orders" — what the count is counting. */
  noun: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  const button =
    "inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-xs font-bold text-secondary transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
      <p className="text-xs text-muted">
        {first}–{last} of {total} {noun}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={button}
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <Icon name="chevron_left" size={16} />
          Previous
        </button>
        <span className="text-xs font-bold text-secondary">
          {page} / {pages}
        </span>
        <button
          type="button"
          className={button}
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Next
          <Icon name="chevron_right" size={16} />
        </button>
      </div>
    </div>
  );
}
