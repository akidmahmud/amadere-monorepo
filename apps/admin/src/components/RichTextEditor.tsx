"use client";

import dynamic from "next/dynamic";

// CKEditor 5 touches browser-only APIs at import time — rendering it during
// Next.js's server pass crashes with "window is not defined" (documented
// CKEditor/Next.js integration requirement), so the real implementation is
// lazy-loaded client-side only.
const RichTextEditorInner = dynamic(
  () => import("./RichTextEditorInner").then((m) => m.RichTextEditorInner),
  {
    ssr: false,
    // Matches RichTextEditorInner's real rendered height (toolbar row +
    // CKEditor's own toolbar + the 340px min-height editable area) — a
    // shorter placeholder here means the page grows taller the instant the
    // real editor mounts, shifting everything below it down mid-click and
    // landing the click on whatever moved into that spot instead (this is
    // what caused clicks on the editor to land on the Fullscreen button).
    loading: () => <div className="min-h-[430px] rounded-sm border border-border bg-surface" />,
  },
);

export function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  return <RichTextEditorInner value={value} onChange={onChange} />;
}
