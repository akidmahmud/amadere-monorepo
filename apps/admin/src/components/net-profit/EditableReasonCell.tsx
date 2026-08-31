"use client";

import { useState } from "react";
import { Icon } from "@amader/admin-ui";
import { useUpdateCartReason } from "@/hooks/useRecovery";

/**
 * The reason on an abandoned cart, editable where it sits.
 *
 * Shared by the funnel table and the trash tab so the same cell behaves the
 * same in both — a reason typed while chasing a cart and one added after
 * binning it are the same field, and having only one of them editable is what
 * made this look broken.
 *
 * Click, type, Enter or blur saves; Escape abandons. Blank clears it, which
 * the service stores as null so "no reason" stays a single state.
 */
export function EditableReasonCell({
  id,
  reason,
  placeholder = "Add a reason",
}: {
  id: number;
  reason: string | null;
  placeholder?: string;
}) {
  const update = useUpdateCartReason();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(reason ?? "");
  const [failed, setFailed] = useState(false);

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next === (reason ?? "")) return; // unchanged — no request
    setFailed(false);
    update.mutate({ id, reason: next }, { onError: () => setFailed(true) });
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          // Stopped from bubbling: this cell lives inside table rows that
          // carry their own key handling and selection.
          e.stopPropagation();
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(reason ?? "");
            setEditing(false);
          }
        }}
        placeholder={placeholder}
        className="h-8 w-full min-w-40 rounded-md border border-brand-500 bg-surface px-2 text-xs text-text outline-none focus:ring-2 focus:ring-brand-500/20"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setDraft(reason ?? "");
        setEditing(true);
      }}
      title="Click to edit"
      className="group flex w-full min-w-40 items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs hover:bg-surface-2"
    >
      <span className={reason ? "text-text" : "italic text-muted"}>
        {update.isPending
          ? "Saving…"
          : failed
            ? "Couldn't save — click to retry"
            : (reason ?? placeholder)}
      </span>
      <Icon
        name="edit"
        size={13}
        className="flex-none text-muted opacity-0 transition-opacity group-hover:opacity-100"
      />
    </button>
  );
}
