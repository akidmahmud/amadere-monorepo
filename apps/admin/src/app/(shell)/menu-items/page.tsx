"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Card } from "@amader/admin-ui";
import {
  useDeleteMenuItem,
  useImportMenuItemsFromCategories,
  useMenuItems,
  useMoveMenuItems,
  type MenuItem,
} from "@/hooks/useMenuItems";

// The storefront navbar only ever renders a top item + one level of dropdown
// children (menus.mapper.ts's toPublicMenuItemDto) — nesting deeper than
// that would build a 3rd level nothing displays, so drag-and-drop caps here.
const MAX_DEPTH = 1;
const INDENT_PX = 32;

const dragHandleIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <circle cx="9" cy="6" r="1.5" />
    <circle cx="15" cy="6" r="1.5" />
    <circle cx="9" cy="12" r="1.5" />
    <circle cx="15" cy="12" r="1.5" />
    <circle cx="9" cy="18" r="1.5" />
    <circle cx="15" cy="18" r="1.5" />
  </svg>
);

interface FlatItem {
  item: MenuItem;
  depth: number;
}

function flatten(items: MenuItem[]): FlatItem[] {
  const roots = items.filter((i) => i.parentId === null).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const flat: FlatItem[] = [];
  for (const root of roots) {
    flat.push({ item: root, depth: 0 });
    const children = items
      .filter((i) => i.parentId === root.id)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder);
    for (const child of children) flat.push({ item: child, depth: 1 });
  }
  return flat;
}

function MenuItemRow({ flat, onDelete }: { flat: FlatItem; onDelete: (id: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: flat.item.id });
  const label = flat.item.translations[0]?.label || flat.item.href;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        marginLeft: flat.depth * INDENT_PX,
      }}
    >
      <Card className="flex items-center gap-3">
        <button
          {...attributes}
          {...listeners}
          type="button"
          aria-label="Drag to reorder — drag right to nest under the item above, left to un-nest"
          title="Drag to reorder — drag right to nest, left to un-nest"
          className="cursor-grab touch-none text-muted"
        >
          {dragHandleIcon}
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-text">{label}</div>
          <div className="truncate text-xs text-muted">
            {flat.item.href}
            {!flat.item.isActive && " · inactive"}
          </div>
        </div>
        {flat.depth === 0 && (
          <Link href={`/menu-items/new?parentId=${flat.item.id}`}>
            <Button type="button" variant="ghost">
              + Add child
            </Button>
          </Link>
        )}
        <Link href={`/menu-items/${flat.item.id}`}>
          <Button type="button" variant="ghost">
            Edit
          </Button>
        </Link>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            if (confirm(`Delete "${label}"? ${flat.depth === 0 ? "Any child items under it will be deleted too. " : ""}This can't be undone.`)) {
              onDelete(flat.item.id);
            }
          }}
        >
          Delete
        </Button>
      </Card>
    </div>
  );
}

export default function MenuItemsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: items, isLoading } = useMenuItems(searchQuery);
  const deleteItem = useDeleteMenuItem();
  const move = useMoveMenuItems();
  const importFromCategories = useImportMenuItemsFromCategories();
  const [dragItems, setDragItems] = useState<MenuItem[] | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const effectiveItems = dragItems ?? items ?? [];
  const flat = useMemo(() => flatten(effectiveItems), [effectiveItems]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over, delta } = event;
    if (!over || active.id === over.id || !items) return;

    const currentFlat = flatten(items);
    const oldIndex = currentFlat.findIndex((f) => f.item.id === active.id);
    const overIndex = currentFlat.findIndex((f) => f.item.id === over.id);
    if (oldIndex === -1 || overIndex === -1) return;
    const activeOriginal = currentFlat[oldIndex];

    const movedOrder = arrayMove(currentFlat, oldIndex, overIndex);
    const newIndex = movedOrder.findIndex((f) => f.item.id === active.id);
    const previous = movedOrder[newIndex - 1];

    // Dragging right nests under the item now directly above; dragging left
    // un-nests. A pure vertical drag (no horizontal intent) keeps whatever
    // depth the item already had, clamped to what the new position allows.
    const horizontalIntent = delta.x > INDENT_PX / 2 ? 1 : delta.x < -INDENT_PX / 2 ? -1 : 0;
    const maxDepth = Math.min(previous ? previous.depth + 1 : 0, MAX_DEPTH);
    const depth = Math.max(0, Math.min(maxDepth, activeOriginal.depth + horizontalIntent));
    const parentId: number | null = depth === 0 ? null : previous.depth === 0 ? previous.item.id : previous.item.parentId;

    const finalOrder = movedOrder.map((f) => (f.item.id === active.id ? { item: { ...f.item, parentId }, depth } : f));

    // sortOrder is per sibling group (same parentId) — recomputed from each
    // group's members' relative order in the final flat list, not a single
    // global counter, since root items and each parent's children each keep
    // their own independent 0-based ordering.
    const siblingCounters = new Map<string, number>();
    const updates: { id: number; parentId: number | null; sortOrder: number }[] = [];
    for (const f of finalOrder) {
      const key = String(f.item.parentId);
      const sortOrder = siblingCounters.get(key) ?? 0;
      siblingCounters.set(key, sortOrder + 1);
      const original = items.find((i) => i.id === f.item.id);
      if (original && (original.parentId !== f.item.parentId || original.sortOrder !== sortOrder)) {
        updates.push({ id: f.item.id, parentId: f.item.parentId, sortOrder });
      }
    }
    if (updates.length === 0) return;

    setDragItems(
      items.map((i) => {
        const upd = updates.find((u) => u.id === i.id);
        return upd ? { ...i, parentId: upd.parentId, sortOrder: upd.sortOrder } : i;
      }),
    );
    move.mutate(updates, { onSettled: () => setDragItems(null) });
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-sm text-secondary">
            {items?.length ?? 0} menu items — drag to reorder, drag right to nest under the item above.
          </p>
          <input
            type="text"
            placeholder="Search menu items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-[38px] w-[220px] rounded-inner border border-border bg-surface px-3 text-[0.76rem] text-text outline-none focus:border-brand-500"
          />
        </div>
        <Link href="/menu-items/new">
          <Button variant="primary">Add menu item</Button>
        </Link>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}

      {items && items.length === 0 && (
        <Card className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted">
            {searchQuery
              ? `No menu items matching "${searchQuery}".`
              : "No menu items yet — the storefront navbar has nothing to show. Start from your existing categories, or add items manually above."}
          </p>
          <Button
            type="button"
            variant="primary"
            disabled={importFromCategories.isPending}
            onClick={() => importFromCategories.mutate()}
          >
            {importFromCategories.isPending ? "Importing…" : "Import from Categories"}
          </Button>
        </Card>
      )}

      {flat.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={flat.map((f) => f.item.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3">
              {flat.map((f) => (
                <MenuItemRow key={f.item.id} flat={f} onDelete={(id) => deleteItem.mutate(id)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </>
  );
}
