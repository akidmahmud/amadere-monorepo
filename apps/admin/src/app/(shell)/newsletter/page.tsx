"use client";

import { useState } from "react";
import { Button, Card, Icon, PageHeader } from "@amader/admin-ui";
import {
  newsletterExportHref,
  useBulkDeleteNewsletterSubscribers,
  useDeleteNewsletterSubscriber,
  useNewsletterSubscribers,
} from "@/hooks/useNewsletter";

const newsletterIcon = <Icon name="mail" />;
const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

export default function NewsletterPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<number[]>([]);

  const { data, isLoading } = useNewsletterSubscribers({ q: q || undefined, page, pageSize });
  const deleteOne = useDeleteNewsletterSubscriber();
  const bulkDelete = useBulkDeleteNewsletterSubscribers();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const allSelected = items.length > 0 && items.every((s) => selected.includes(s.id));

  function toggleAll() {
    setSelected(allSelected ? [] : items.map((s) => s.id));
  }

  function toggleOne(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }

  function handleBulkDelete() {
    if (selected.length === 0) return;
    if (!confirm(`Delete ${selected.length} subscriber(s)?`)) return;
    bulkDelete.mutate(selected, { onSuccess: () => setSelected([]) });
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={newsletterIcon}
        title="Newsletter"
        subtitle="Subscribers collected from the storefront signup form."
        style={{ background: "linear-gradient(135deg, #140A24 0%, #5F03AA 100%)" }}
      />

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <input
              placeholder="Search by email…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className={`${inputClass} w-64`}
            />
            <span className="text-sm text-secondary">{total} subscriber{total === 1 ? "" : "s"}</span>
          </div>
          <div className="flex items-center gap-2">
            {selected.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                disabled={bulkDelete.isPending}
                onClick={handleBulkDelete}
                className="border-danger text-danger hover:bg-danger/10"
              >
                Delete selected ({selected.length})
              </Button>
            )}
            <a href={newsletterExportHref(q || undefined)}>
              <Button type="button" variant="ghost">
                <Icon name="download" size={16} /> Export CSV
              </Button>
            </a>
          </div>
        </div>

        {isLoading && <p className="text-sm text-muted">Loading…</p>}
        {!isLoading && items.length === 0 && <p className="text-sm text-muted">No subscribers yet.</p>}

        {items.length > 0 && (
          <div className="overflow-x-auto rounded-inner border border-border">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-xs font-semibold uppercase tracking-wide text-secondary">
                  <th className="w-10 px-3 py-2.5">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                  </th>
                  <th className="px-3 py-2.5">Email</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Subscribed</th>
                  <th className="w-16 px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5">
                      <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggleOne(s.id)} />
                    </td>
                    <td className="px-3 py-2.5 text-text">{s.email}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          s.status === "SUBSCRIBED" ? "bg-success/10 text-success" : "bg-surface-2 text-muted"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-muted">{new Date(s.subscribedAt).toLocaleDateString()}</td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        aria-label="Delete subscriber"
                        disabled={deleteOne.isPending}
                        onClick={() => {
                          if (confirm(`Delete ${s.email}?`)) deleteOne.mutate(s.id);
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

        {total > 0 && (
          <div className="flex items-center justify-between text-sm text-secondary">
            <div className="flex items-center gap-2">
              <span>
                Showing {start}–{end} of {total}
              </span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className={inputClass}
              >
                {[20, 50, 100].map((n) => (
                  <option key={n} value={n}>{n} / page</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span>Page {page} of {totalPages}</span>
              <Button type="button" variant="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
