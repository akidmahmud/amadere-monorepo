"use client";

import { useRef, useState } from "react";
import { Button, Modal } from "@amader/admin-ui";

const PROMPT = `Write a blog article as a single clean HTML fragment for a Next.js storefront blog.

Rules:
- Output ONLY the HTML fragment — no <html>/<head>/<body>, no markdown code fences, no commentary.
- Use <h2> and <h3> for section headings only (they auto-generate the table of contents — don't use <h1>, don't skip levels).
- Use <p>, <ul>/<ol>, <blockquote>, <strong>/<em>, and <a href="..."> where natural.
- Include <img src="..." alt="descriptive text"> placeholders where an image would help — real URLs get swapped in via the Media Library after upload.
- Do not include the post title, meta description, or FAQ — those are set separately in the editor.
- Add at least one internal link opportunity (e.g. <a href="/products/...">) where relevant.
- Aim for 300+ words with at least one <h2>, a meta description, and a linked source for a healthy SEO score.`;

// Lets an editor paste a topic into Claude elsewhere using the prompt below,
// then drop the returned .html file straight into the Content field instead
// of retyping it — the file is read client-side, no upload endpoint needed.
export function HtmlImportButton({ onImport }: { onImport: (html: string) => void }) {
  const [open, setOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function readFile(file: File) {
    if (!/\.html?$/i.test(file.name)) {
      setError("Please select an .html file.");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      onImport(String(reader.result ?? ""));
      setOpen(false);
    };
    reader.readAsText(file);
  }

  return (
    <>
      <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
        Add HTML
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Import HTML content">
        <div className="flex flex-col gap-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) readFile(file);
            }}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed p-8 text-center transition-colors ${
              dragOver ? "border-brand-500 bg-brand-500/5" : "border-border"
            }`}
          >
            <p className="text-sm font-semibold text-text">Drag and drop an HTML file here</p>
            <p className="text-xs text-muted">or click to browse — .html / .htm</p>
            <input
              ref={inputRef}
              type="file"
              accept=".html,.htm,text/html"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) readFile(file);
                e.target.value = "";
              }}
            />
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="flex flex-col gap-2 rounded-card border border-border bg-surface-2 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-secondary">Prompt for Claude</span>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  navigator.clipboard.writeText(PROMPT);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-xs text-secondary">{PROMPT}</pre>
            <p className="text-xs text-muted">
              Give this to Claude along with your topic, save the HTML it returns as a .html file, then drop it above — it replaces the Content field below.
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}
