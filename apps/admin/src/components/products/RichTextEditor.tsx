"use client";

import { useEffect, useRef, useState } from "react";

const TOOLBAR_BUTTONS: { label: string; command: string; value?: string; bold?: boolean; italic?: boolean; underline?: boolean }[] = [
  { label: "B", command: "bold", bold: true },
  { label: "I", command: "italic", italic: true },
  { label: "U", command: "underline", underline: true },
  { label: "H2", command: "formatBlock", value: "h2" },
  { label: "H3", command: "formatBlock", value: "h3" },
  { label: "¶", command: "formatBlock", value: "p" },
];

const STATE_COMMANDS = ["bold", "italic", "underline", "insertUnorderedList", "insertOrderedList"];

// Native contentEditable + document.execCommand — deprecated but still
// universally supported for these basic commands in every evergreen
// browser, and it's the whole editor for zero added dependencies. This
// codebase has no rich-text library installed anywhere (checked); pulling
// one in just for a Bold/Italic/H2/list toolbar would be a lot of new
// surface area for what's a small, well-understood browser API.
export function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const lastValue = useRef(value);
  const [activeStates, setActiveStates] = useState<Record<string, boolean>>({});

  // Only push `value` into the DOM when it changed from *outside* (e.g. the
  // page-level seedFrom() on the edit page) — otherwise every keystroke's
  // onInput->onChange->re-render loop would reset the caret to the start.
  useEffect(() => {
    if (ref.current && value !== lastValue.current) {
      ref.current.innerHTML = value;
    }
    lastValue.current = value;
  }, [value]);

  // Toolbar buttons otherwise give zero feedback about whether the caret is
  // already inside bold/italic/underlined text, which reads as "nothing
  // happened" when a command actually did toggle. Recompute on every
  // selection change within the editor.
  function refreshActiveStates() {
    const next: Record<string, boolean> = {};
    for (const cmd of STATE_COMMANDS) next[cmd] = document.queryCommandState(cmd);
    setActiveStates(next);
  }

  function exec(command: string, arg?: string) {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    if (ref.current) {
      lastValue.current = ref.current.innerHTML;
      onChange(ref.current.innerHTML);
    }
    refreshActiveStates();
  }

  return (
    <div className="rounded-sm border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-surface-2 p-1.5">
        {TOOLBAR_BUTTONS.map((b) => (
          <button
            key={b.label}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(b.command, b.value)}
            className={`grid h-7 w-7 place-items-center rounded-[6px] text-xs transition-colors hover:bg-brand-50 hover:text-brand-600 ${
              activeStates[b.command] ? "bg-brand-500 text-white hover:bg-brand-600 hover:text-white" : "text-secondary"
            } ${b.bold ? "font-bold" : ""} ${b.italic ? "italic" : ""} ${b.underline ? "underline" : ""}`}
          >
            {b.label}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("insertUnorderedList")}
          className={`grid h-7 w-7 place-items-center rounded-[6px] text-xs transition-colors hover:bg-brand-50 hover:text-brand-600 ${
            activeStates.insertUnorderedList ? "bg-brand-500 text-white hover:bg-brand-600 hover:text-white" : "text-secondary"
          }`}
          aria-label="Bullet list"
        >
          •≡
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("insertOrderedList")}
          className={`grid h-7 w-7 place-items-center rounded-[6px] text-xs transition-colors hover:bg-brand-50 hover:text-brand-600 ${
            activeStates.insertOrderedList ? "bg-brand-500 text-white hover:bg-brand-600 hover:text-white" : "text-secondary"
          }`}
          aria-label="Numbered list"
        >
          1.≡
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const url = prompt("Link URL:");
            if (url) exec("createLink", url);
          }}
          className="grid h-7 w-7 place-items-center rounded-[6px] text-xs text-secondary transition-colors hover:bg-brand-50 hover:text-brand-600"
          aria-label="Insert link"
        >
          🔗
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        // Native contentEditable drag-to-move-selected-text was firing
        // whenever a new drag-select started on top of an existing
        // selection (e.g. re-selecting after a double-click), silently
        // relocating the selected text instead of re-selecting it — the
        // root cause behind "the toolbar buttons don't work": the click
        // either formatted the wrong (post-drag) selection or never landed
        // because a native drag was still in flight. Selecting text to
        // format it should never move it.
        onDragStart={(e) => e.preventDefault()}
        onInput={() => {
          if (ref.current) {
            lastValue.current = ref.current.innerHTML;
            onChange(ref.current.innerHTML);
          }
          refreshActiveStates();
        }}
        onKeyUp={refreshActiveStates}
        onMouseUp={refreshActiveStates}
        onFocus={refreshActiveStates}
        className="min-h-[130px] p-3 text-sm leading-relaxed text-text outline-none [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-bold [&_ul]:ml-5 [&_ul]:list-disc [&_ol]:ml-5 [&_ol]:list-decimal [&_a]:text-brand-500 [&_a]:underline"
      />
    </div>
  );
}
