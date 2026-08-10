"use client";

import { useState } from "react";
import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import { Icon } from "@amader/admin-ui";
import type { AdminPromoVideo } from "@/hooks/usePromoVideos";
import { PromoVideoSourceIcon, sourceLabel } from "./PromoVideoSourceIcon";

function formatDuration(seconds: number | null): string | null {
  if (seconds === null) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Strips the protocol (and "www.") for a compact display link — the real
// stored URL, not a fabricated youtu.be-style shortener (the source domain
// varies per platform/video and isn't something this admin can rewrite).
function displayUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "");
}

export function PromoVideoListRow({
  video,
  isSelected,
  onSelect,
  onToggleShowInHomepage,
  onDelete,
}: {
  video: AdminPromoVideo;
  isSelected: boolean;
  onSelect: () => void;
  onToggleShowInHomepage: (value: boolean) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: video.id });
  const [menuOpen, setMenuOpen] = useState(false);
  const duration = formatDuration(video.durationSeconds);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className={`flex items-center gap-3 rounded-[10px] border p-3 transition-colors ${
        isSelected ? "border-brand-500 bg-brand-50" : "border-border bg-surface hover:bg-surface-2"
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        type="button"
        aria-label="Drag to reorder"
        className="grid h-6 w-6 flex-none cursor-grab touch-none place-items-center text-muted"
      >
        <Icon name="drag_indicator" size={18} />
      </button>

      {/* A <div>, not a <button> — it wraps a real <a> below, and a link
          nested inside a button is invalid HTML with unpredictable click
          behavior (verified live: the click landed on the link instead of
          selecting the row). role="button" + tabIndex + onKeyDown keeps it
          keyboard-operable without that nesting violation. */}
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
      >
        <div className="relative h-14 w-[72px] flex-none overflow-hidden rounded-[8px] bg-surface-2">
          {video.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 grid place-items-center bg-black/10">
            <div className="grid h-6 w-6 place-items-center rounded-full bg-white/90 text-text">
              <Icon name="play_arrow" size={16} fill />
            </div>
          </div>
          {duration && (
            <span className="absolute bottom-1 right-1 rounded-[4px] bg-black/70 px-1 text-[0.62rem] font-semibold text-white">
              {duration}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-[0.86rem] font-bold text-text">{video.title}</div>
          <div className="mt-1 flex items-center gap-1.5">
            <PromoVideoSourceIcon source={video.source} />
            <span className="text-[0.72rem] font-semibold text-secondary">{sourceLabel(video.source, video.url)}</span>
          </div>
          <a
            href={video.url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-1 flex items-center gap-1 truncate text-[0.72rem] font-medium text-brand-500 hover:underline"
          >
            <Icon name="link" size={13} />
            <span className="truncate">{displayUrl(video.url)}</span>
          </a>
          {video.productId !== null && (
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-pill bg-[#e3f7ee] px-2 py-0.5 text-[0.66rem] font-bold text-[#16a06d]">
              <Icon name="link" size={12} />
              Linked Product
            </span>
          )}
        </div>
      </div>

      <label className="relative inline-flex h-[22px] w-10 flex-none cursor-pointer items-center">
        <input
          type="checkbox"
          checked={video.showInHomepage}
          onChange={(e) => onToggleShowInHomepage(e.target.checked)}
          className="peer sr-only"
        />
        <span className="absolute inset-0 rounded-pill bg-[#dfe5ee] transition-colors peer-checked:bg-brand-500" />
        <span className="absolute left-[3px] h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-[18px]" />
      </label>

      <div className="relative flex-none">
        <button
          type="button"
          aria-label="More actions"
          onClick={() => setMenuOpen((v) => !v)}
          className="grid h-8 w-8 place-items-center rounded-[8px] text-muted hover:bg-surface-2"
        >
          <Icon name="more_vert" size={18} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-9 z-10 w-32 rounded-[8px] border border-border bg-surface p-1 shadow-card">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onDelete();
              }}
              className="w-full rounded-[6px] px-2.5 py-1.5 text-left text-[0.78rem] font-semibold text-danger hover:bg-surface-2"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
