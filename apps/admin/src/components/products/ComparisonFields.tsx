"use client";

import { MediaPicker } from "@/components/MediaPicker";
import type { ComparisonCardState, ProductFormState } from "./useProductFormState";

const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";
const textareaClass = "rounded-sm border border-border bg-surface p-3 text-sm text-text outline-none focus:border-brand-500";

function ComparisonCardFields({
  title,
  card,
  onChange,
}: {
  title: string;
  card: ComparisonCardState;
  onChange: (card: ComparisonCardState) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-sm border border-border bg-surface-2 p-3">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{title}</span>
      <MediaPicker value={card.imageUrl || undefined} onChange={(url) => onChange({ ...card, imageUrl: url })} label="Image" />
      <input
        placeholder="Title"
        value={card.title}
        onChange={(e) => onChange({ ...card, title: e.target.value })}
        className={inputClass}
      />
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">List items (one per line)</span>
        <textarea
          value={card.items}
          onChange={(e) => onChange({ ...card, items: e.target.value })}
          rows={5}
          className={textareaClass}
        />
      </label>
    </div>
  );
}

export function ComparisonFields({ form }: { form: ProductFormState }) {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs text-muted">
        Optional PDP section: a heading plus two cards side-by-side — the left card ("us") is styled with green
        checkmarks, the right card ("them") with red X marks. Leave both card images empty to hide this section
        entirely on the storefront.
      </p>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Heading (HTML allowed)</span>
        <textarea
          value={form.comparisonHeading}
          onChange={(e) => form.setComparisonHeading(e.target.value)}
          rows={2}
          className={textareaClass}
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <ComparisonCardFields title="Card 1 (Us)" card={form.comparisonCard1} onChange={form.setComparisonCard1} />
        <ComparisonCardFields title="Card 2 (Them)" card={form.comparisonCard2} onChange={form.setComparisonCard2} />
      </div>
    </div>
  );
}
