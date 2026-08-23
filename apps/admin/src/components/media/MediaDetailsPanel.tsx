"use client";

import { useEffect, useState } from "react";
import { Icon } from "@amader/admin-ui";
import { useUpdateMediaAltText } from "@/hooks/useMedia";
import type { components } from "@/lib/api/schema";
import { mediaDisplayName, mediaExtension } from "@/lib/media-name";

type MediaDto = components["schemas"]["MediaDto"];

function Row({ label, children, icon }: { label: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-surface-2/60 p-2.5 border border-border/50">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
        {icon}
        <span>{label}</span>
      </div>
      <div className="break-words text-xs font-medium text-text">{children}</div>
    </div>
  );
}

export function MediaDetailsPanel({
  item,
  onClose,
  isModal = false,
}: {
  item: MediaDto;
  onClose: () => void;
  isModal?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const url = item.fullUrl ?? item.url;

  const updateAltText = useUpdateMediaAltText();
  const [altDraft, setAltDraft] = useState(item.altText ?? "");
  const [altSaved, setAltSaved] = useState(false);

  useEffect(() => {
    setAltDraft(item.altText ?? "");
    setAltSaved(false);
  }, [item.id, item.altText]);

  const altDirty = altDraft !== (item.altText ?? "");

  async function saveAltText() {
    if (!altDirty) return;
    await updateAltText.mutateAsync({ id: item.id, altText: altDraft });
    setAltSaved(true);
    setTimeout(() => setAltSaved(false), 2000);
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked
    }
  }

  const ext = (mediaExtension(item.url) || item.type || "FILE").toUpperCase();

  return (
    <aside
      className={`sticky flex w-[320px] shrink-0 flex-col gap-4 overflow-y-auto rounded-2xl border border-border/80 bg-surface/95 p-4 shadow-xl backdrop-blur-md transition-all z-10 ${
        isModal
          ? "top-0 max-h-[calc(88vh-110px)]"
          : "top-[80px] max-h-[calc(100vh-105px)]"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500 font-bold text-xs">
            ℹ
          </span>
          <div>
            <h3 className="text-xs font-bold text-text">Media Inspector</h3>
            <p className="text-[10px] text-muted">File attributes & settings</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Close details"
          className="grid h-7 w-7 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          <Icon name="close" size={16} />
        </button>
      </div>

      {/* Preview Box */}
      <div className="group relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-gradient-to-b from-surface-2 to-surface p-2 shadow-inner">
        {item.type === "VIDEO" ? (
          <video src={url} controls className="h-full w-full rounded-lg object-contain" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.cardUrl ?? item.url}
            alt={item.altText ?? ""}
            className="h-full w-full rounded-lg object-contain transition-transform duration-300 group-hover:scale-105"
          />
        )}
        <span className="absolute top-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
          {ext}
        </span>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          title="Open full size"
          className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-lg bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 backdrop-blur-sm hover:bg-brand-500"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      </div>

      {/* Title */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Filename</span>
        <span className="break-all text-xs font-semibold text-text" title={mediaDisplayName(item.url)}>
          {mediaDisplayName(item.url)}
        </span>
      </div>

      {/* Copy Link Input */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Direct URL</span>
          {copied && <span className="text-[10px] font-bold text-success animate-pulse">✓ Copied to clipboard</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full min-w-0 rounded-xl border border-border/70 bg-surface-2 px-3 py-1.5 text-[11px] text-text outline-none focus:border-brand-500 font-mono"
          />
          <button
            type="button"
            onClick={copyUrl}
            title="Copy URL"
            className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-xl border border-brand-500/30 bg-brand-50 px-2.5 text-xs font-semibold text-brand-600 hover:bg-brand-500 hover:text-white transition-all active:scale-95"
          >
            <Icon name={copied ? "check" : "content_copy"} size={14} />
            <span className="text-[11px] font-bold">{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>

      {/* Alt Text Box */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Alt Description</span>
          {altSaved && <span className="text-[10px] font-bold text-success">Saved ✓</span>}
        </div>
        <textarea
          rows={2}
          value={altDraft}
          placeholder="Describe image for SEO & accessibility"
          onChange={(e) => setAltDraft(e.target.value)}
          onBlur={saveAltText}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          className="w-full resize-y rounded-xl border border-border/80 bg-surface-2 px-3 py-2 text-xs text-text transition-all focus:border-brand-500 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
        <p className="text-[10px] text-muted leading-tight">
          {updateAltText.isPending
            ? "Saving changes…"
            : altDirty
              ? "Press Enter or click outside to save"
              : "Improves accessibility & SEO search rankings."}
        </p>
        {updateAltText.isError && (
          <p className="text-[10px] font-semibold text-danger">
            {(updateAltText.error as Error)?.message ?? "Failed to save alt text"}
          </p>
        )}
      </div>

      {/* Details Specs */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <Row label="Dimensions">
          {item.width && item.height ? `${item.width} × ${item.height} px` : "N/A"}
        </Row>
        <Row label="Format">{ext}</Row>
      </div>

      <Row label="Uploaded On">
        {new Date(item.createdAt).toLocaleString(undefined, {
          year: "numeric",
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </Row>
    </aside>
  );
}

