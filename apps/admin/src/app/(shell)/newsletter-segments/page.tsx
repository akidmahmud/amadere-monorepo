"use client";

import { useState } from "react";
import { Button, Card, Icon, Modal, PageHeader } from "@amader/admin-ui";
import { useToast } from "@/components/ToastProvider";
import { ProxyApiError } from "@/lib/api/proxy-client";
import { friendlyErrorMessage } from "@/lib/friendly-error";
import { useCreateSegment, useDeleteSegment, useNewsletterSegments, useSegmentCount, type SegmentType } from "@/hooks/useNewsletterSegments";
import { useNewsletterTags } from "@/hooks/useNewsletterTags";

const segmentsIcon = <Icon name="groups" />;
const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

const TYPE_LABEL: Record<SegmentType, string> = {
  ALL: "All subscribed subscribers",
  TAG: "Subscribers with a tag",
  NEW_SUBSCRIBERS: "Recently subscribed",
};

function SegmentCount({ id }: { id: number }) {
  const { data } = useSegmentCount(id);
  return <span>{data ? data.count : "…"}</span>;
}

export default function NewsletterSegmentsPage() {
  const { data: segments, isLoading } = useNewsletterSegments();
  const { data: tags } = useNewsletterTags();
  const toast = useToast();
  const createSegment = useCreateSegment();
  const deleteSegment = useDeleteSegment();

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<SegmentType>("ALL");
  const [tagId, setTagId] = useState<number | "">("");
  const [days, setDays] = useState(30);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createSegment.mutateAsync({
        name,
        type,
        tagId: type === "TAG" && tagId !== "" ? tagId : undefined,
        days: type === "NEW_SUBSCRIBERS" ? days : undefined,
      });
      setShowAdd(false);
      setName("");
      setType("ALL");
      setTagId("");
      setDays(30);
    } catch (err) {
      toast.push(err instanceof ProxyApiError ? friendlyErrorMessage(err.message) : "Failed to create segment");
    }
  }

  const canSubmit = name.trim() && (type !== "TAG" || tagId !== "");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={segmentsIcon}
        title="Newsletter Segments"
        subtitle="Audience groups you can target when sending a campaign."
        style={{ background: "linear-gradient(135deg, #140A24 0%, #5F03AA 100%)" }}
        actions={
          <Button type="button" variant="primary" onClick={() => setShowAdd(true)}>
            <Icon name="add" size={16} /> Create Segment
          </Button>
        }
      />

      <Card className="flex flex-col gap-4">
        {isLoading && <p className="text-sm text-muted">Loading…</p>}
        {!isLoading && segments && segments.length === 0 && (
          <p className="text-sm text-muted">No segments yet — campaigns default to all subscribed subscribers.</p>
        )}

        {segments && segments.length > 0 && (
          <div className="overflow-x-auto rounded-inner border border-border">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-xs font-semibold uppercase tracking-wide text-secondary">
                  <th className="px-3 py-2.5">Name</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5">Subscribers</th>
                  <th className="w-16 px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {segments.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5 font-semibold text-text">{s.name}</td>
                    <td className="px-3 py-2.5 text-muted">
                      {TYPE_LABEL[s.type]}
                      {s.type === "TAG" && tags && <> — {tags.find((t) => t.id === s.tagId)?.name ?? "?"}</>}
                      {s.type === "NEW_SUBSCRIBERS" && <> — last {s.days} days</>}
                    </td>
                    <td className="px-3 py-2.5 text-text">
                      <SegmentCount id={s.id} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        aria-label="Delete segment"
                        onClick={() => {
                          if (confirm(`Delete "${s.name}"?`)) deleteSegment.mutate(s.id);
                        }}
                        className="text-danger hover:opacity-70"
                      >
                        <Icon name="delete" size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Create Segment">
        <form onSubmit={handleAdd} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Name</span>
            <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Type</span>
            <select value={type} onChange={(e) => setType(e.target.value as SegmentType)} className={inputClass}>
              <option value="ALL">All subscribed subscribers</option>
              <option value="TAG">Subscribers with a tag</option>
              <option value="NEW_SUBSCRIBERS">Recently subscribed</option>
            </select>
          </label>
          {type === "TAG" && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Tag</span>
              <select required value={tagId} onChange={(e) => setTagId(e.target.value ? Number(e.target.value) : "")} className={inputClass}>
                <option value="">Select a tag…</option>
                {tags?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {tags && tags.length === 0 && <span className="text-xs text-muted">No tags yet — add one from the Newsletter subscribers page.</span>}
            </label>
          )}
          {type === "NEW_SUBSCRIBERS" && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Subscribed within (days)</span>
              <input type="number" min={1} max={3650} value={days} onChange={(e) => setDays(Number(e.target.value))} className={inputClass} />
            </label>
          )}
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={!canSubmit || createSegment.isPending}>
              {createSegment.isPending ? "Creating…" : "Create Segment"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
