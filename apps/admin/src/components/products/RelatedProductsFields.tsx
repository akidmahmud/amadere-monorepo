"use client";

import { useEffect, useState } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Card, FormSkeleton, Icon } from "@amader/admin-ui";
import { usePickerProducts } from "@/hooks/usePickers";
import { PickerPrice } from "@/components/PickerPrice";
import { useRelatedProducts, useUpdateRelatedProducts } from "@/hooks/useRelatedProducts";

// One picked product. Draggable because ORDER is the whole point of this
// section — the storefront renders these left to right in exactly this
// sequence (ProductRelation.position), unlike cross-sell/FBT where the
// admin has no say.
function SortableRow({ id, label, onRemove }: { id: number; label: string; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-inner border border-border bg-surface px-2 py-1.5 ${isDragging ? "opacity-60" : ""}`}
    >
      <button
        type="button"
        aria-label={`Reorder ${label}`}
        className="cursor-grab text-muted active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <Icon name="drag_indicator" size={18} />
      </button>
      <span className="min-w-0 flex-1 truncate text-[0.74rem] font-semibold text-text">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="px-1 text-sm font-extrabold text-muted transition-colors hover:text-danger"
      >
        ×
      </button>
    </div>
  );
}

/**
 * Manual related products — the storefront's "আমাদের শপে আরও দেখতে পারেন"
 * section. Available on EVERY product, physical and digital: it is one shared
 * field, mounted from both ProductFormFields and DigitalProductFormFields.
 *
 * Self-contained sibling section with its own query/mutation/save button, the
 * same pattern CrossSellFields uses — it is not part of the main product
 * form's payload.
 */
export function RelatedProductsFields({ productId }: { productId: number }) {
  const { data: products } = usePickerProducts();
  const { data: current, isLoading } = useRelatedProducts(productId);
  const update = useUpdateRelatedProducts(productId);
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    if (current) setSelected(current);
  }, [current]);

  // Sold-out products are left out of the list -- recommending something
  // nobody can buy is a dead end for the shopper. An already-picked product
  // that has since gone out of stock stays visible, though: dropping it would
  // strip its label off the chip above and leave no way to remove it.
  const options = (products ?? []).filter(
    (p) => p.id !== productId && (!p.outOfStock || selected.includes(p.id)),
  );
  const labelOf = (id: number) => options.find((p) => p.id === id)?.label ?? `#${id}`;
  const filteredProducts = options.filter((p) => p.label.toLowerCase().includes(search.trim().toLowerCase()));

  function toggle(id: number) {
    // Appended, not inserted — a newly ticked product joins the END of the
    // order, which is what an admin building a list top-down expects.
    setSelected(selected.includes(id) ? selected.filter((i) => i !== id) : [...selected, id]);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSelected((ids) => arrayMove(ids, ids.indexOf(active.id as number), ids.indexOf(over.id as number)));
  }

  return (
    <Card className="flex max-w-2xl flex-col gap-4">
      <h3 className="font-ui text-sm font-bold text-text">Related Products (&ldquo;আমাদের শপে আরও দেখতে পারেন&rdquo;)</h3>
      <p className="text-xs text-muted">
        Shown at the bottom of this product&apos;s page, in the order below — drag to rearrange. Leave empty and the
        storefront falls back to its automatic same-category suggestions.
      </p>

      {isLoading ? (
        <FormSkeleton />
      ) : (
        <>
          {selected.length > 0 && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={selected} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-1.5">
                  {selected.map((id) => (
                    <SortableRow key={id} id={id} label={labelOf(id)} onRemove={() => toggle(id)} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="h-9 w-full rounded-inner border border-border bg-surface px-2.5 text-[0.74rem] text-text outline-none focus:border-brand-500"
          />
          <div className="flex max-h-[210px] flex-col gap-0.5 overflow-y-auto rounded-inner border border-border p-1.5">
            {filteredProducts.map((p) => (
              <label
                key={p.id}
                className="flex cursor-pointer items-center gap-2 rounded-[7px] px-1.5 py-1.5 text-[0.74rem] font-semibold text-text hover:bg-surface-2"
              >
                <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} className="h-3.5 w-3.5 shrink-0 accent-brand-500" />
                <span className="min-w-0 flex-1 truncate">{p.label}</span>
                <PickerPrice price={p.price} salePrice={p.salePrice} />
              </label>
            ))}
            {filteredProducts.length === 0 && <p className="px-1.5 py-2 text-[0.72rem] text-muted">No products match your search.</p>}
          </div>

          <Button type="button" variant="primary" className="self-start" disabled={update.isPending} onClick={() => update.mutate(selected)}>
            {update.isPending ? "Saving…" : "Save related products"}
          </Button>
        </>
      )}
    </Card>
  );
}
