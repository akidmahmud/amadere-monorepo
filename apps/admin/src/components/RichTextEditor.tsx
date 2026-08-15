"use client";

import dynamic from "next/dynamic";

// CKEditor 5 touches browser-only APIs at import time — rendering it during
// Next.js's server pass crashes with "window is not defined" (documented
// CKEditor/Next.js integration requirement), so the real implementation is
// lazy-loaded client-side only.
//
// Two loading placeholders (full vs. compact) since each variant's real
// rendered height differs — a mismatched placeholder means the page grows
// (or shrinks) the instant the real editor mounts, shifting everything below
// it mid-click and landing the click on whatever moved into that spot
// instead (this is what caused clicks on the editor to land on the
// Fullscreen button before the placeholder heights were added at all).
const RichTextEditorInnerFull = dynamic(
  () => import("./RichTextEditorInner").then((m) => m.RichTextEditorInner),
  { ssr: false, loading: () => <div className="min-h-[430px] rounded-sm border border-border bg-surface" /> },
);
const RichTextEditorInnerCompact = dynamic(
  () => import("./RichTextEditorInner").then((m) => m.RichTextEditorInner),
  { ssr: false, loading: () => <div className="min-h-[120px] rounded-sm border border-border bg-surface" /> },
);

export function RichTextEditor({
  value,
  onChange,
  compact,
}: {
  value: string;
  onChange: (html: string) => void;
  /** Short "short description"-style fields — minimal toolbar, ~120px canvas. */
  compact?: boolean;
}) {
  const Inner = compact ? RichTextEditorInnerCompact : RichTextEditorInnerFull;
  return <Inner value={value} onChange={onChange} compact={compact} />;
}
