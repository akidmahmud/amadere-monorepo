"use client";

import { diffWords } from "diff";
import { useBlogPostRevisions } from "@/hooks/useBlogPosts";

// Content fields are raw HTML — diffing tags directly reads as noise, so
// this strips them down to plain text before comparing.
function stripHtml(html: string | null): string {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function DiffCell({ before, after }: { before: string | null; after: string | null }) {
  const parts = diffWords(stripHtml(before), stripHtml(after));
  return (
    <p className="max-w-md text-xs leading-relaxed">
      {parts.map((part, i) => (
        <span
          key={i}
          className={
            part.added
              ? "bg-[#dcfce7] text-[#16a06d]"
              : part.removed
                ? "bg-[#fee2e2] text-[#dc2626] line-through"
                : "text-text"
          }
        >
          {part.value}
        </span>
      ))}
    </p>
  );
}

// Matches the reference CMS's "Revision History" tab: one row per changed
// field, word-level highlighting of what actually changed (green = added,
// red strikethrough = removed) rather than just showing two opaque blobs.
export function RevisionHistoryTable({ postId }: { postId: number }) {
  const { data: revisions, isLoading } = useBlogPostRevisions(postId);

  if (isLoading) return <p className="text-sm text-muted">Loading…</p>;
  if (!revisions || revisions.length === 0) {
    return <p className="text-sm text-muted">No changes recorded yet — this fills in the next time the post is saved.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface-2 text-[11px] font-semibold uppercase tracking-wide text-secondary">
          <tr>
            <th className="p-3">Author</th>
            <th className="p-3">Field</th>
            <th className="p-3">Change</th>
            <th className="p-3">When</th>
          </tr>
        </thead>
        <tbody>
          {revisions.map((r) => (
            <tr key={r.id} className="border-t border-border align-top">
              <td className="whitespace-nowrap p-3 font-semibold text-text">{r.author ?? "—"}</td>
              <td className="whitespace-nowrap p-3 text-text">{r.field}</td>
              <td className="p-3">
                <DiffCell before={r.before} after={r.after} />
              </td>
              <td className="whitespace-nowrap p-3 text-muted">{new Date(r.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
