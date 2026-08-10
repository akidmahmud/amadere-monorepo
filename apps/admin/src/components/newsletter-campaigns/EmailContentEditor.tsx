"use client";

import { useRef } from "react";
import { Icon } from "@amader/admin-ui";
import type { EmailBlock, EmailContentMode } from "@/hooks/useNewsletterCampaigns";
import { EmailBlockEditor } from "./EmailBlockEditor";

const MAX_HTML_BYTES = 300_000;

const modeTabClass = (active: boolean) =>
  `rounded-sm px-3 py-1.5 text-xs font-semibold transition-colors ${
    active ? "bg-brand-500 text-white" : "bg-surface-2 text-secondary hover:text-text"
  }`;

// Shared by CampaignEditor and the template editor — a design uploaded as a
// whole HTML file skips the block editor entirely (spec followup: "HTML
// design file upload"). The server sanitizes on save (and on preview), so
// this side only needs to get the raw text into state.
export function EmailContentEditor({
  mode,
  blocks,
  html,
  onModeChange,
  onBlocksChange,
  onHtmlChange,
  disabled,
}: {
  mode: EmailContentMode;
  blocks: EmailBlock[];
  html: string;
  onModeChange: (mode: EmailContentMode) => void;
  onBlocksChange: (blocks: EmailBlock[]) => void;
  onHtmlChange: (html: string) => void;
  disabled?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_HTML_BYTES) {
      alert(`File too large — max ${Math.round(MAX_HTML_BYTES / 1000)}KB`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onHtmlChange(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <button type="button" disabled={disabled} className={modeTabClass(mode === "blocks")} onClick={() => onModeChange("blocks")}>
          Blocks
        </button>
        <button type="button" disabled={disabled} className={modeTabClass(mode === "html")} onClick={() => onModeChange("html")}>
          Custom HTML
        </button>
      </div>

      {mode === "blocks" ? (
        <EmailBlockEditor blocks={blocks} onChange={onBlocksChange} />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted">
            Upload a complete HTML design file (e.g. exported from an email design tool). The unsubscribe link and open
            tracking are appended automatically — per-link click tracking isn&apos;t available for custom HTML.
          </p>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".html,text/html"
              disabled={disabled}
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="hidden"
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => fileInputRef.current?.click()}
              className="flex h-10 items-center gap-1.5 rounded-sm border border-border bg-surface px-3 text-sm font-semibold text-text hover:bg-surface-2 disabled:opacity-50"
            >
              <Icon name="upload_file" size={16} /> Upload HTML file
            </button>
            {html && <span className="text-xs text-muted">{(html.length / 1000).toFixed(1)}KB loaded</span>}
          </div>
          <textarea
            value={html}
            disabled={disabled}
            onChange={(e) => onHtmlChange(e.target.value)}
            placeholder="<html>…</html>"
            rows={10}
            spellCheck={false}
            className="w-full rounded-sm border border-border bg-surface p-3 font-mono text-xs text-text outline-none focus:border-brand-500"
          />
        </div>
      )}
    </div>
  );
}
