"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon, TableSkeleton } from "@amader/admin-ui";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PUBLISH_STATUSES } from "@/hooks/useBrands";
import {
  useCategories,
  useDeleteCategory,
  useReorderCategories,
  useUpdateCategory,
  type AdminCategory,
} from "@/hooks/useCategories";

const STATUS_PILL: Record<string, string> = {
  PUBLISHED: "bg-[#e3f7ee] text-[#16a06d]",
  DRAFT: "bg-[#f1eafe] text-[#8b5cf6]",
  ARCHIVED: "bg-surface-2 text-secondary",
  PENDING: "bg-[#fdf1dc] text-[#e0821c]",
};
const STATUS_LABEL: Record<string, string> = {
  PUBLISHED: "Published",
  DRAFT: "Draft",
  ARCHIVED: "Archived",
  PENDING: "Pending",
};

function Pill({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-[6px] px-2.5 py-1 text-[0.68rem] font-bold ${className}`}
    >
      {children}
    </span>
  );
}

const starIcon = (filled: boolean) => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill={filled ? "#f5a623" : "#dfe5e0"}
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);
const editIcon = (
  <svg
    viewBox="0 0 24 24"
    width="13"
    height="13"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </svg>
);
const deleteIcon = (
  <svg
    viewBox="0 0 24 24"
    width="13"
    height="13"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  </svg>
);

function CategoryRow({
  category: c,
  parentName,
  onDelete,
  canReorder,
}: {
  category: AdminCategory;
  parentName: string | undefined;
  onDelete: (c: AdminCategory) => void;
  canReorder: boolean;
}) {
  const update = useUpdateCategory(c.id);
  const name = c.translations[0]?.name ?? c.slug;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: c.id, disabled: !canReorder });

  return (
    <tr
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="border-b border-[#f1f5fa] last:border-b-0 hover:bg-[#fafcfe]"
    >
      <td className="px-1 py-3 align-middle">
        {canReorder ? (
          <button
            {...attributes}
            {...listeners}
            type="button"
            aria-label="Drag to reorder this category"
            title="Drag to reorder. Order applies within each parent — this never moves a category to a different parent."
            className="cursor-grab touch-none px-0.5 text-[#c3cbd8] transition-colors hover:text-brand-500"
          >
            <Icon name="drag_indicator" size={18} />
          </button>
        ) : (
          <span
            title="Clear the filters to reorder — dragging a filtered list would renumber only the rows you can see."
            className="block px-0.5 text-[#e2e8f0]"
          >
            <Icon name="drag_indicator" size={18} />
          </span>
        )}
      </td>
      <td className="px-2.5 py-3 align-middle">
        {c.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={c.imageUrl}
            alt=""
            className="h-[42px] w-[42px] rounded-[9px] border border-border object-cover"
          />
        ) : (
          <div className="grid h-[42px] w-[42px] place-items-center rounded-[9px] border border-border bg-surface-2 text-base">
            🗂️
          </div>
        )}
      </td>
      <td className="px-2.5 py-3 align-middle">
        <div className="min-w-[160px]">
          <span className="block font-bold text-text">{name}</span>
          <span className="text-[0.7rem] font-medium text-muted">{c.slug}</span>
        </div>
      </td>
      <td className="px-2.5 py-3 align-middle whitespace-nowrap text-[0.78rem] font-semibold text-text">
        {parentName ?? "—"}
      </td>
      <td className="px-2.5 py-3 align-middle whitespace-nowrap text-[0.78rem] font-bold text-text">
        {c.productCount ?? 0}
      </td>
      <td className="px-2.5 py-3 align-middle">
        <button
          type="button"
          onClick={() => update.mutate({ isFeatured: !c.isFeatured })}
          aria-label={c.isFeatured ? "Unfeature category" : "Feature category"}
          className="grid h-7 w-7 place-items-center rounded-[7px] hover:bg-surface-2"
        >
          {starIcon(c.isFeatured)}
        </button>
      </td>
      <td className="px-2.5 py-3 align-middle whitespace-nowrap">
        <Pill
          className={STATUS_PILL[c.status] ?? "bg-surface-2 text-secondary"}
        >
          {STATUS_LABEL[c.status] ?? c.status}
        </Pill>
      </td>
      <td className="px-2.5 py-3 align-middle">
        <div className="flex items-center gap-1.5">
          <Link
            href={`/categories/${c.id}`}
            aria-label="Edit"
            className="grid h-[30px] w-[30px] place-items-center rounded-[8px] bg-brand-50 text-brand-500 hover:bg-brand-100"
          >
            {editIcon}
          </Link>
          <button
            type="button"
            aria-label="Delete"
            onClick={() => onDelete(c)}
            className="grid h-[30px] w-[30px] place-items-center rounded-[8px] text-muted hover:bg-surface-2"
          >
            {deleteIcon}
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function CategoriesPage() {
  const { data: categories, isLoading } = useCategories();
  const deleteCategory = useDeleteCategory();
  const reorder = useReorderCategories();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminCategory | null>(null);

  function nameFor(id: number | null) {
    if (!id) return undefined;
    const c = categories?.find((c) => c.id === id);
    return c ? (c.translations[0]?.name ?? c.slug) : undefined;
  }

  const query = q.trim().toLowerCase();
  const filtered = (categories ?? []).filter((c) => {
    const matchesQuery =
      !query ||
      (c.translations[0]?.name ?? "").toLowerCase().includes(query) ||
      c.slug.toLowerCase().includes(query);
    const matchesStatus = !status || c.status === status;
    return matchesQuery && matchesStatus;
  });

  // Dragging is only offered on the full, unfiltered list. Reordering a
  // filtered view would send only the visible ids, and the server ranks each
  // parent group 0..n from what it receives — so hidden siblings would keep
  // stale ranks and collide with the new ones.
  const canReorder = !query && !status;

  // Local echo so the row lands where it was dropped instead of waiting for
  // the refetch.
  const [dragOrder, setDragOrder] = useState<number[] | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const ordered = dragOrder
    ? (dragOrder
        .map((id) => filtered.find((c) => c.id === id))
        .filter(Boolean) as AdminCategory[])
    : filtered;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = ordered.map((c) => c.id);
    const next = arrayMove(
      ids,
      ids.indexOf(active.id as number),
      ids.indexOf(over.id as number),
    );
    setDragOrder(next);
    reorder.mutate(next, { onSettled: () => setDragOrder(null) });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-secondary">
        This is where your storefront&apos;s category tree lives — every
        category customers browse products through. Publish or archive one, nest
        it under a parent, and mark it Featured to highlight it on the homepage.
        <br />
        <span lang="bn">
          আপনার স্টোরফ্রন্টের ক্যাটেগরি তালিকা এখান থেকে পরিচালনা করা হয় —
          গ্রাহকরা এই ক্যাটেগরিগুলোর মাধ্যমেই পণ্য খুঁজে পান। যেকোনো ক্যাটেগরি
          প্রকাশ বা আর্কাইভ করুন, প্যারেন্ট ক্যাটেগরির অধীনে রাখুন, এবং হোমপেজে
          হাইলাইট করতে ফিচার্ড হিসেবে চিহ্নিত করুন।
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
          <span className="text-[0.76rem] font-semibold text-muted">
            {filtered.length} of {categories?.length ?? 0} categories
          </span>
          <Link
            href="/categories/new"
            className="ml-auto inline-flex h-[38px] items-center gap-1.5 rounded-inner bg-brand-500 px-[15px] text-[0.8rem] font-bold text-white hover:bg-brand-600"
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Category
          </Link>
        </div>

        {isLoading ? (
          <div className="mt-3">
            <TableSkeleton />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="w-[26px] rounded-l-[8px] bg-[#f7f9fc] px-1 py-[11px]">
                    <span className="sr-only">Reorder</span>
                  </th>
                  {[
                    "Image",
                    "Category",
                    "Parent",
                    "Products",
                    "Featured",
                    "Status",
                    "Actions",
                  ].map((h, i) => (
                    <th
                      key={h}
                      className={`whitespace-nowrap bg-[#f7f9fc] px-2.5 py-[11px] text-left text-[0.73rem] font-bold text-secondary ${i === 6 ? "rounded-r-[8px]" : ""}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-2.5 py-8 text-center text-sm text-muted"
                    >
                      {categories?.length === 0
                        ? "No categories yet."
                        : "No categories match these filters."}
                    </td>
                  </tr>
                )}
                <SortableContext
                  items={ordered.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {ordered.map((c) => (
                    <CategoryRow
                      key={c.id}
                      category={c}
                      parentName={nameFor(c.parentId)}
                      onDelete={setDeleteTarget}
                      canReorder={canReorder}
                    />
                  ))}
                </SortableContext>
              </tbody>
            </table>
            </DndContext>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteCategory.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        pending={deleteCategory.isPending}
        title={`Delete "${deleteTarget ? (deleteTarget.translations[0]?.name ?? deleteTarget.slug) : ""}"?`}
        description="This permanently removes the category. Products in it won't be deleted, but they'll lose this category."
      />
    </div>
  );
}
