"use client";

import { useState } from "react";

const MAX_BADGES = 5;

// Storage stays the plain newline-delimited string the API already expects
// (ProductTranslationDto.keyBenefits) — only the editing UI is chip-based.
function parse(value: string): string[] {
  return value.split("\n").map((s) => s.trim()).filter(Boolean);
}

export function ProductBadgesField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const badges = parse(value);
  const [draft, setDraft] = useState("");

  function add() {
    const text = draft.trim();
    if (!text || badges.length >= MAX_BADGES) return;
    onChange([...badges, text].join("\n"));
    setDraft("");
  }

  function remove(i: number) {
    onChange(badges.filter((_, idx) => idx !== i).join("\n"));
  }

  return (
    <div>
      {badges.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {badges.map((b, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-[6px] bg-brand-50 px-2.5 py-1 text-[0.74rem] font-bold text-brand-500">
              {b}
              <button type="button" onClick={() => remove(i)} className="font-extrabold opacity-80 hover:opacity-100" aria-label={`Remove ${b}`}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {badges.length < MAX_BADGES ? (
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="e.g. 100% Organic"
            className="h-9 flex-1 rounded-sm border border-border bg-surface px-2.5 text-sm text-text outline-none focus:border-brand-500"
          />
          <button type="button" onClick={add} className="rounded-sm border border-border px-3 text-sm font-bold text-text hover:border-brand-500">
            Add
          </button>
        </div>
      ) : (
        <p className="text-[0.72rem] text-muted">Maximum of {MAX_BADGES} badges reached.</p>
      )}
    </div>
  );
}
