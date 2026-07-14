"use client";

import { useState } from "react";
import Link from "next/link";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Card } from "@amader/admin-ui";
import {
  useDeleteHomepageSection,
  useHomepageSections,
  useReorderHomepageSections,
  useUpdateHomepageSection,
  type AdminHomepageSection,
} from "@/hooks/useHomepageSections";

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

function SectionRow({ section }: { section: AdminHomepageSection }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const updateSection = useUpdateHomepageSection(section.id);
  const deleteSection = useDeleteHomepageSection();
  const heading = section.translations[0]?.heading;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
    >
      <Card className="flex items-center gap-3">
        <button
          {...attributes}
          {...listeners}
          type="button"
          aria-label="Drag to reorder"
          className="cursor-grab touch-none text-muted"
        >
          {dragHandleIcon}
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-text">{heading || "(no heading)"}</div>
          <div className="text-xs text-muted">{section.type.replaceAll("_", " ")}</div>
        </div>
        <label className="flex items-center gap-2 text-xs text-secondary">
          <input
            type="checkbox"
            checked={section.isActive}
            onChange={(e) => updateSection.mutate({ isActive: e.target.checked })}
          />
          Active
        </label>
        <Link href={`/homepage-sections/${section.id}`}>
          <Button type="button" variant="ghost">
            Edit
          </Button>
        </Link>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            if (confirm("Delete this section? This can't be undone.")) deleteSection.mutate(section.id);
          }}
        >
          Delete
        </Button>
      </Card>
    </div>
  );
}

export default function HomepageSectionsPage() {
  const { data: sections, isLoading } = useHomepageSections();
  const reorder = useReorderHomepageSections();
  const [dragOrder, setDragOrder] = useState<number[] | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const ordered: AdminHomepageSection[] | undefined = dragOrder
    ? (dragOrder.map((id) => sections?.find((s) => s.id === id)).filter(Boolean) as AdminHomepageSection[])
    : sections;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !sections) return;
    const ids = sections.map((s) => s.id);
    const oldIndex = ids.indexOf(active.id as number);
    const newIndex = ids.indexOf(over.id as number);
    const newOrder = arrayMove(ids, oldIndex, newIndex);
    setDragOrder(newOrder);
    reorder.mutate(newOrder);
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary">Sections render on the homepage top-to-bottom in this order.</p>
        <Link href="/homepage-sections/new">
          <Button variant="primary">Add section</Button>
        </Link>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {ordered && ordered.length === 0 && (
        <p className="text-sm text-muted">No sections yet — add one to populate the homepage.</p>
      )}

      {ordered && ordered.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ordered.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3">
              {ordered.map((section) => (
                <SectionRow key={section.id} section={section} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </>
  );
}
