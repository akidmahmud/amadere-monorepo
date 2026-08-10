"use client";

import { useState } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Button, Icon } from "@amader/admin-ui";
import {
  useDeletePromoVideo,
  usePromoVideos,
  useReorderPromoVideos,
  useUpdatePromoVideo,
  type AdminPromoVideo,
} from "@/hooks/usePromoVideos";
import { PromoVideoListRow } from "@/components/promo-videos/PromoVideoListRow";
import { PromoVideoEditPanel } from "@/components/promo-videos/PromoVideoEditPanel";

// Toggling "showInHomepage" straight from the list row needs its own
// mutation instance per row (useUpdatePromoVideo is scoped to one id) —
// this tiny wrapper exists only so PromoVideosPage doesn't call a hook
// inside .map().
function PromoVideoRowContainer({
  video,
  isSelected,
  onSelect,
}: {
  video: AdminPromoVideo;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const update = useUpdatePromoVideo(video.id);
  const remove = useDeletePromoVideo();
  return (
    <PromoVideoListRow
      video={video}
      isSelected={isSelected}
      onSelect={onSelect}
      onToggleShowInHomepage={(showInHomepage) => update.mutate({ showInHomepage })}
      onDelete={() => {
        if (confirm(`Delete "${video.title}"? This can't be undone.`)) remove.mutate(video.id);
      }}
    />
  );
}

export default function PromoVideosPage() {
  const { data: videos, isLoading } = usePromoVideos();
  const reorder = useReorderPromoVideos();
  const [selectedId, setSelectedId] = useState<number | "new" | null>(null);
  const [dragOrder, setDragOrder] = useState<number[] | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const ordered = dragOrder
    ? (dragOrder.map((id) => videos?.find((v) => v.id === id)).filter(Boolean) as NonNullable<typeof videos>)
    : videos;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !videos) return;
    const ids = videos.map((v) => v.id);
    const newOrder = arrayMove(ids, ids.indexOf(active.id as number), ids.indexOf(over.id as number));
    setDragOrder(newOrder);
    reorder.mutate(newOrder);
  }

  const selectedVideo = typeof selectedId === "number" ? (videos?.find((v) => v.id === selectedId) ?? null) : null;
  const editing = selectedId === "new" || selectedVideo !== null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 flex-none place-items-center rounded-[12px] bg-[#6366f1] text-white">
            <Icon name="smart_display" size={22} />
          </div>
          <div>
            <h1 className="font-ui text-lg font-bold text-text">Promo Videos</h1>
            <p className="text-xs text-muted">Manage short promo videos that appear on your website</p>
          </div>
        </div>
        <Button type="button" variant="primary" onClick={() => setSelectedId("new")}>
          <Icon name="add" size={16} /> Add New Video
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
        <div className="rounded-card border border-border bg-surface p-[22px] shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-ui text-sm font-bold text-text">Video List</h2>
              <p className="text-xs text-muted">Drag to reorder videos</p>
            </div>
          </div>

          {isLoading && <p className="text-sm text-muted">Loading…</p>}
          {ordered && ordered.length === 0 && <p className="text-sm text-muted">No videos yet — add one to get started.</p>}

          {ordered && ordered.length > 0 && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={ordered.map((v) => v.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2.5">
                  {ordered.map((video) => (
                    <PromoVideoRowContainer
                      key={video.id}
                      video={video}
                      isSelected={selectedId === video.id}
                      onSelect={() => setSelectedId(video.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          <p className="mt-4 flex items-center gap-1.5 text-xs text-muted">
            <Icon name="info" size={14} />
            Videos will appear on your homepage in the order shown above.
          </p>
        </div>

        {editing ? (
          <PromoVideoEditPanel
            key={selectedId ?? "new"}
            video={selectedVideo}
            onSaved={(id) => setSelectedId(id)}
            onRemoved={() => setSelectedId(null)}
            onCancel={() => setSelectedId(null)}
          />
        ) : (
          <div className="grid h-full min-h-[240px] place-items-center rounded-card border border-dashed border-border p-8 text-center text-sm text-muted">
            Select a video to edit, or click "Add New Video" to create one.
          </div>
        )}
      </div>
    </div>
  );
}
