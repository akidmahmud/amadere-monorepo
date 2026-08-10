"use client";

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Icon } from "@amader/admin-ui";
import { MediaPicker } from "@/components/MediaPicker";
import type { EmailBlock, EmailBlockType } from "@/hooks/useNewsletterCampaigns";

const BLOCK_LABELS: Record<EmailBlockType, string> = {
  heading: "Heading",
  text: "Text",
  image: "Image",
  button: "Button",
  divider: "Divider",
  spacer: "Spacer",
};

const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

function BlockFields({ block, onChange }: { block: EmailBlock; onChange: (content: Record<string, unknown>) => void }) {
  switch (block.type) {
    case "heading":
      return (
        <div className="flex gap-2">
          <input
            placeholder="Heading text"
            value={String(block.content.text ?? "")}
            onChange={(e) => onChange({ ...block.content, text: e.target.value })}
            className={`${inputClass} flex-1`}
          />
          <select
            value={String(block.content.align ?? "left")}
            onChange={(e) => onChange({ ...block.content, align: e.target.value })}
            className={inputClass}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
      );
    case "text":
      return (
        <textarea
          placeholder="Paragraph text"
          value={String(block.content.text ?? "")}
          onChange={(e) => onChange({ ...block.content, text: e.target.value })}
          rows={3}
          className="w-full rounded-sm border border-border bg-surface p-3 text-sm text-text outline-none focus:border-brand-500"
        />
      );
    case "image":
      return <MediaPicker value={block.content.url as string | undefined} onChange={(url) => onChange({ ...block.content, url })} label="Image" />;
    case "button":
      return (
        <div className="flex gap-2">
          <input
            placeholder="Button text"
            value={String(block.content.text ?? "")}
            onChange={(e) => onChange({ ...block.content, text: e.target.value })}
            className={`${inputClass} w-40`}
          />
          <input
            placeholder="https://…"
            value={String(block.content.url ?? "")}
            onChange={(e) => onChange({ ...block.content, url: e.target.value })}
            className={`${inputClass} flex-1`}
          />
        </div>
      );
    case "spacer":
      return (
        <label className="flex items-center gap-2 text-xs font-semibold text-secondary">
          Height (px)
          <input
            type="number"
            min={0}
            max={200}
            value={Number(block.content.height ?? 24)}
            onChange={(e) => onChange({ ...block.content, height: Number(e.target.value) })}
            className={`${inputClass} w-24`}
          />
        </label>
      );
    case "divider":
      return <p className="text-xs text-muted">A plain horizontal rule — nothing to configure.</p>;
  }
}

function SortableBlock({
  block,
  index,
  onChange,
  onRemove,
}: {
  block: EmailBlock;
  index: number;
  onChange: (content: Record<string, unknown>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: index });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex items-start gap-3 rounded-inner border border-border bg-surface-2 p-3"
    >
      <button {...attributes} {...listeners} type="button" aria-label="Drag to reorder" className="mt-1.5 cursor-grab touch-none text-muted">
        <Icon name="drag_indicator" size={18} />
      </button>
      <div className="flex-1">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-secondary">{BLOCK_LABELS[block.type]}</span>
          <button type="button" onClick={onRemove} className="text-danger hover:opacity-70">
            <Icon name="delete" size={16} />
          </button>
        </div>
        <BlockFields block={block} onChange={onChange} />
      </div>
    </div>
  );
}

// Deliberately not drag-and-drop-canvas WYSIWYG (newsletter spec §6: "Do not
// build a complicated Canva-style email builder for V1") — an ordered list
// of typed blocks with inline fields, reordered via the same @dnd-kit
// pattern already used for Homepage Sections / Promo Videos.
export function EmailBlockEditor({ blocks, onChange }: { blocks: EmailBlock[]; onChange: (blocks: EmailBlock[]) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function addBlock(type: EmailBlockType) {
    const defaults: Record<EmailBlockType, Record<string, unknown>> = {
      heading: { text: "", align: "left" },
      text: { text: "" },
      image: { url: "" },
      button: { text: "Shop Now", url: "" },
      divider: {},
      spacer: { height: 24 },
    };
    onChange([...blocks, { type, content: defaults[type] }]);
  }

  function updateBlock(index: number, content: Record<string, unknown>) {
    onChange(blocks.map((b, i) => (i === index ? { ...b, content } : b)));
  }

  function removeBlock(index: number) {
    onChange(blocks.filter((_, i) => i !== index));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onChange(arrayMove(blocks, Number(active.id), Number(over.id)));
  }

  return (
    <div className="flex flex-col gap-3">
      {blocks.length === 0 && <p className="text-sm text-muted">No content yet — add a block below.</p>}
      {blocks.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={blocks.map((_, i) => i)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2.5">
              {blocks.map((block, i) => (
                <SortableBlock key={i} block={block} index={i} onChange={(content) => updateBlock(i, content)} onRemove={() => removeBlock(i)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(BLOCK_LABELS) as EmailBlockType[]).map((type) => (
          <Button key={type} type="button" variant="ghost" onClick={() => addBlock(type)}>
            <Icon name="add" size={14} /> {BLOCK_LABELS[type]}
          </Button>
        ))}
      </div>
    </div>
  );
}
