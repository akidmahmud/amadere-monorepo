"use client";

import { useState } from "react";
import Link from "next/link";
import { TableSkeleton } from "@amader/admin-ui";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PUBLISH_STATUSES } from "@/hooks/useBrands";
import { useCollections, useDeleteCollection, useUpdateCollection, type AdminCollection } from "@/hooks/useCollections";

const STATUS_PILL: Record<string, string> = {
  PUBLISHED: "bg-[#e3f7ee] text-[#16a06d]",
  DRAFT: "bg-[#f1eafe] text-[#8b5cf6]",
  ARCHIVED: "bg-surface-2 text-secondary",
  PENDING: "bg-[#fdf1dc] text-[#e0821c]",
};
const STATUS_LABEL: Record<string, string> = { PUBLISHED: "Published", DRAFT: "Draft", ARCHIVED: "Archived", PENDING: "Pending" };

function Pill({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`inline-flex items-center rounded-[6px] px-2.5 py-1 text-[0.68rem] font-bold ${className}`}>{children}</span>;
}

const editIcon = (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </svg>
);
const deleteIcon = (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  </svg>
);
const navIcon = (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

function CollectionRow({ collection: c, onDelete }: { collection: AdminCollection; onDelete: (c: AdminCollection) => void }) {
  const update = useUpdateCollection(c.id);
  const name = c.translations[0]?.name ?? c.slug;

  return (
    <tr className="border-b border-[#f1f5fa] last:border-b-0 hover:bg-[#fafcfe]">
      <td className="px-2.5 py-3 align-middle">
        <div className="min-w-[180px]">
          <span className="block font-bold text-text">{name}</span>
          <span className="text-[0.7rem] font-medium text-muted">{c.slug}</span>
        </div>
      </td>
      <td className="px-2.5 py-3 align-middle whitespace-nowrap text-[0.78rem] font-bold text-text">{c.products.length}</td>
      <td className="px-2.5 py-3 align-middle whitespace-nowrap">
        <button
          type="button"
          onClick={() => update.mutate({ showInNav: !c.showInNav })}
          className="inline-flex items-center gap-1.5"
          aria-label={c.showInNav ? "Remove from navbar" : "Show in navbar"}
        >
          <Pill className={c.showInNav ? "bg-[#e3f7ee] text-[#16a06d]" : "bg-surface-2 text-secondary"}>
            {navIcon}
            {c.showInNav ? "In navbar" : "Not in navbar"}
          </Pill>
        </button>
      </td>
      <td className="px-2.5 py-3 align-middle whitespace-nowrap">
        <Pill className={STATUS_PILL[c.status] ?? "bg-surface-2 text-secondary"}>{STATUS_LABEL[c.status] ?? c.status}</Pill>
      </td>
      <td className="px-2.5 py-3 align-middle">
        <div className="flex items-center gap-1.5">
          <Link href={`/collections/${c.id}`} aria-label="Edit" className="grid h-[30px] w-[30px] place-items-center rounded-[8px] bg-brand-50 text-brand-500 hover:bg-brand-100">
            {editIcon}
          </Link>
          <button type="button" aria-label="Delete" onClick={() => onDelete(c)} className="grid h-[30px] w-[30px] place-items-center rounded-[8px] text-muted hover:bg-surface-2">
            {deleteIcon}
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function CollectionsPage() {
  const { data: collections, isLoading } = useCollections();
  const deleteCollection = useDeleteCollection();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminCollection | null>(null);

  const query = q.trim().toLowerCase();
  const filtered = (collections ?? []).filter((c) => {
    const matchesQuery = !query || (c.translations[0]?.name ?? "").toLowerCase().includes(query) || c.slug.toLowerCase().includes(query);
    const matchesStatus = !status || c.status === status;
    return matchesQuery && matchesStatus;
  });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-secondary">
        Collections group products together for a purpose — a homepage section, a seasonal promotion, or a navbar link —
        separately from the fixed category tree. Toggle a collection into the navbar or publish it right from this list.
        <br />
        <span lang="bn">
          কালেকশন হলো নির্দিষ্ট কোনো উদ্দেশ্যে পণ্য একত্র করার উপায় — যেমন হোমপেজ সেকশন, মৌসুমি প্রচারণা, বা নেভবার লিংক — যা স্থায়ী
          ক্যাটেগরি তালিকা থেকে আলাদা। এই তালিকা থেকেই সরাসরি কোনো কালেকশন নেভবারে যুক্ত করুন বা প্রকাশ করুন।
        </span>
      </p>

      <div className="rounded-card border border-border bg-surface p-[18px_18px_14px] shadow-card">
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or slug…"
            className="h-[38px] w-[220px] rounded-inner border border-border bg-surface px-3 text-[0.76rem] text-text outline-none focus:border-brand-500"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-[38px] rounded-inner border border-border bg-surface px-2.5 text-[0.75rem] font-semibold text-secondary outline-none"
          >
            <option value="">All Statuses</option>
            {PUBLISH_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s] ?? s}
              </option>
            ))}
          </select>
          <span className="text-[0.76rem] font-semibold text-muted">{filtered.length} of {collections?.length ?? 0} collections</span>
          <Link
            href="/collections/new"
            className="ml-auto inline-flex h-[38px] items-center gap-1.5 rounded-inner bg-brand-500 px-[15px] text-[0.8rem] font-bold text-white hover:bg-brand-600"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Collection
          </Link>
        </div>

        {isLoading ? (
          <div className="mt-3">
            <TableSkeleton />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {["Collection", "Products", "Navbar", "Status", "Actions"].map((h, i) => (
                    <th
                      key={h}
                      className={`whitespace-nowrap bg-[#f7f9fc] px-2.5 py-[11px] text-left text-[0.73rem] font-bold text-secondary ${i === 0 ? "rounded-l-[8px]" : ""} ${i === 4 ? "rounded-r-[8px]" : ""}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-2.5 py-8 text-center text-sm text-muted">
                      {collections?.length === 0 ? "No collections yet." : "No collections match these filters."}
                    </td>
                  </tr>
                )}
                {filtered.map((c) => (
                  <CollectionRow key={c.id} collection={c} onDelete={setDeleteTarget} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteCollection.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        pending={deleteCollection.isPending}
        title={`Delete "${deleteTarget ? (deleteTarget.translations[0]?.name ?? deleteTarget.slug) : ""}"?`}
        description="This permanently removes the collection. Products in it are unaffected — they just won't be grouped here anymore."
      />
    </div>
  );
}
