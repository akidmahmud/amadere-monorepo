"use client";

import { useRef, useState } from "react";
import { Button, Card, Icon, Modal, PageHeader } from "@amader/admin-ui";
import { useToast } from "@/components/ToastProvider";
import { ProxyApiError } from "@/lib/api/proxy-client";
import { friendlyErrorMessage } from "@/lib/friendly-error";
import {
  newsletterExportHref,
  useAddSubscriberTag,
  useBulkDeleteNewsletterSubscribers,
  useCreateNewsletterSubscriber,
  useDeleteNewsletterSubscriber,
  useImportNewsletterCsv,
  useNewsletterSubscribers,
  useRemoveSubscriberTag,
  type CsvImportResult,
} from "@/hooks/useNewsletter";
import { useCreateTag, useDeleteTag, useNewsletterTags } from "@/hooks/useNewsletterTags";

const newsletterIcon = <Icon name="mail" />;
const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

function TagChips({ subscriberId, tags }: { subscriberId: number; tags: { id: number; name: string }[] }) {
  const { data: allTags } = useNewsletterTags();
  const addTag = useAddSubscriberTag();
  const removeTag = useRemoveSubscriberTag();
  const available = (allTags ?? []).filter((t) => !tags.some((existing) => existing.id === t.id));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <span key={t.id} className="flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-secondary">
          {t.name}
          <button
            type="button"
            aria-label={`Remove tag ${t.name}`}
            onClick={() => removeTag.mutate({ id: subscriberId, tagId: t.id })}
            className="text-muted hover:text-danger"
          >
            <Icon name="close" size={12} />
          </button>
        </span>
      ))}
      {available.length > 0 && (
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) addTag.mutate({ id: subscriberId, tagId: Number(e.target.value) });
          }}
          className="h-6 rounded-full border border-dashed border-border bg-surface px-1.5 text-xs text-muted outline-none"
        >
          <option value="">+ tag</option>
          {available.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function ManageTagsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: tags } = useNewsletterTags();
  const createTag = useCreateTag();
  const deleteTag = useDeleteTag();
  const toast = useToast();
  const [newTagName, setNewTagName] = useState("");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createTag.mutateAsync(newTagName);
      setNewTagName("");
    } catch (err) {
      toast.push(err instanceof ProxyApiError ? friendlyErrorMessage(err.message) : "Failed to create tag");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Manage Tags">
      <div className="flex flex-col gap-3">
        <form onSubmit={handleAdd} className="flex items-center gap-2">
          <input
            placeholder="New tag name…"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            className={`${inputClass} flex-1`}
          />
          <Button type="submit" variant="primary" disabled={!newTagName.trim() || createTag.isPending}>
            Add
          </Button>
        </form>
        <div className="flex flex-col gap-1.5">
          {(tags ?? []).length === 0 && <p className="text-sm text-muted">No tags yet.</p>}
          {tags?.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-inner border border-border px-3 py-2">
              <span className="text-sm text-text">{t.name}</span>
              <button
                type="button"
                aria-label={`Delete tag ${t.name}`}
                onClick={() => {
                  if (confirm(`Delete tag "${t.name}"? This removes it from every subscriber.`)) deleteTag.mutate(t.id);
                }}
                className="text-danger hover:opacity-70"
              >
                <Icon name="delete" size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function ImportErrorsModal({ result, onClose }: { result: CsvImportResult | null; onClose: () => void }) {
  return (
    <Modal open={result !== null} onClose={onClose} title="Import Results">
      {result && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text">
            Imported <span className="font-semibold">{result.imported}</span>, skipped <span className="font-semibold">{result.skipped}</span>.
          </p>
          {result.errors.length > 0 && (
            <div className="flex flex-col gap-1 rounded-inner border border-border p-3 text-xs text-secondary">
              {result.errors.map((e, i) => (
                <div key={i}>
                  Line {e.line}: {e.reason}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function NewsletterPage() {
  const [q, setQ] = useState("");
  const [tagId, setTagId] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<number[]>([]);

  const [showAdd, setShowAdd] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [importResult, setImportResult] = useState<CsvImportResult | null>(null);

  const toast = useToast();
  const { data, isLoading } = useNewsletterSubscribers({ q: q || undefined, tagId, page, pageSize });
  const { data: tags } = useNewsletterTags();
  const deleteOne = useDeleteNewsletterSubscriber();
  const bulkDelete = useBulkDeleteNewsletterSubscribers();
  const createOne = useCreateNewsletterSubscriber();
  const importCsv = useImportNewsletterCsv();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    createOne.mutate(
      { email: newEmail, name: newName || undefined },
      {
        onSuccess: () => {
          setShowAdd(false);
          setNewEmail("");
          setNewName("");
        },
      },
    );
  }

  async function handleImportFile(file: File | undefined) {
    if (!file) return;
    try {
      const result = await importCsv.mutateAsync(file);
      setImportResult(result);
    } catch (err) {
      toast.push(err instanceof ProxyApiError ? friendlyErrorMessage(err.message) : "Import failed");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

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
        actions={
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={() => setShowTags(true)}>
              <Icon name="sell" size={16} /> Manage Tags
            </Button>
            <Button type="button" variant="primary" onClick={() => setShowAdd(true)}>
              <Icon name="add" size={16} /> Add Subscriber
            </Button>
          </div>
        }
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
            <select
              value={tagId ?? ""}
              onChange={(e) => {
                setTagId(e.target.value ? Number(e.target.value) : undefined);
                setPage(1);
              }}
              className={inputClass}
            >
              <option value="">All tags</option>
              {tags?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
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
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => handleImportFile(e.target.files?.[0])} />
            <Button type="button" variant="ghost" disabled={importCsv.isPending} onClick={() => fileInputRef.current?.click()}>
              <Icon name="upload_file" size={16} /> {importCsv.isPending ? "Importing…" : "Import CSV"}
            </Button>
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
                  <th className="px-3 py-2.5">Name</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Tags</th>
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
                    <td className="px-3 py-2.5 text-muted">{s.name || "—"}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          s.status === "SUBSCRIBED" ? "bg-success/10 text-success" : "bg-surface-2 text-muted"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <TagChips subscriberId={s.id} tags={s.tags} />
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

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Subscriber">
        <form onSubmit={handleAdd} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Email</span>
            <input type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Name (optional)</span>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} className={inputClass} />
          </label>
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={createOne.isPending}>
              {createOne.isPending ? "Adding…" : "Add Subscriber"}
            </Button>
          </div>
        </form>
      </Modal>

      <ManageTagsModal open={showTags} onClose={() => setShowTags(false)} />
      <ImportErrorsModal result={importResult} onClose={() => setImportResult(null)} />
    </div>
  );
}
