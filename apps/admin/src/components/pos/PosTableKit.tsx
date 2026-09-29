"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@amader/admin-ui";

/** Client-side paging over an already-loaded list. */
export function usePaged<T>(rows: T[], size = 25) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, pages);
  return {
    page: current,
    pages,
    setPage,
    items: rows.slice((current - 1) * size, current * size),
    from: rows.length ? (current - 1) * size + 1 : 0,
    to: Math.min(current * size, rows.length),
    total: rows.length,
  };
}

export function Pager({
  page,
  pages,
  from,
  to,
  total,
  setPage,
  noun,
}: ReturnType<typeof usePaged<unknown>> & { noun: string }) {
  const btn =
    "grid h-9 min-w-9 place-items-center rounded-lg border border-gray-200 px-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-40";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-3 text-sm text-gray-600">
      <span>
        {total ? `${from}–${to} of ${total}` : `0`} {noun}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          className={btn}
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          aria-label="Previous page"
        >
          <Icon name="chevron_left" size={18} />
        </button>
        <span className="px-2">
          Page <b>{page}</b> of {pages}
        </span>
        <button
          className={btn}
          disabled={page >= pages}
          onClick={() => setPage(page + 1)}
          aria-label="Next page"
        >
          <Icon name="chevron_right" size={18} />
        </button>
      </div>
    </div>
  );
}

/** Square product photo, or a placeholder icon. */
export function Thumb({ url }: { url?: string | null }) {
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-contain" />
      ) : (
        <Icon name="image" size={20} className="text-gray-300" />
      )}
    </span>
  );
}

/** "⋯" button with a small action menu. */
export function RowMenu({
  label,
  actions,
}: {
  label: string;
  actions: {
    label: string;
    icon: string;
    onClick: () => void;
    danger?: boolean;
    disabled?: boolean;
  }[];
}) {
  // Where to draw the menu (fixed, so a scrolling table can't clip it).
  const [open, setOpen] = useState<{ top: number; right: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(null);
    };
    const close = () => setOpen(null);
    document.addEventListener("mousedown", off);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", off);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);
  return (
    <div className="relative inline-block" ref={ref}>
      <button
        className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100"
        onClick={(e) => {
          if (open) return setOpen(null);
          const r = e.currentTarget.getBoundingClientRect();
          // Open upwards near the bottom of the screen.
          const up = window.innerHeight - r.bottom < 60 + actions.length * 40;
          setOpen({
            top: up ? r.top - 8 - actions.length * 40 : r.bottom + 4,
            right: window.innerWidth - r.right,
          });
        }}
        aria-label={`Actions for ${label}`}
        aria-expanded={!!open}
      >
        <Icon name="more_horiz" size={20} />
      </button>
      {open && (
        <div
          style={{ top: open.top, right: open.right }}
          className="fixed z-50 w-max min-w-44 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 text-left shadow-lg"
        >
          {actions.map((a) => (
            <button
              key={a.label}
              disabled={a.disabled}
              onClick={() => {
                setOpen(null);
                a.onClick();
              }}
              className={`flex w-full items-center justify-start gap-2.5 whitespace-nowrap px-3 py-2 text-left text-sm font-semibold disabled:opacity-40 ${a.danger ? "text-red-600 hover:bg-red-50" : "text-gray-700 hover:bg-emerald-50"}`}
            >
              <Icon name={a.icon} size={18} /> {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const toolbarInput =
  "flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm focus-within:border-[#1d7a46]";
