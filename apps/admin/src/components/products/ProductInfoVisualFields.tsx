"use client";

import { MediaPicker } from "@/components/MediaPicker";
import type { ProductFormState } from "./useProductFormState";

const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";
const textareaClass = "rounded-sm border border-border bg-surface p-3 text-sm text-text outline-none focus:border-brand-500";

const ARROW_POSITION_LABELS = ["Top Left", "Bottom Left", "Top Right", "Bottom Right"];

export function ProductInfoVisualFields({ form }: { form: ProductFormState }) {
  function updateArrow(index: number, field: "heading" | "subheading", value: string) {
    form.setInfoVisualArrows(form.infoVisualArrows.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  }

  function updateCircle(index: number, field: "imageUrl" | "label", value: string) {
    form.setInfoVisualCircles(form.infoVisualCircles.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs text-muted">
        Optional PDP section: a central image with 4 curved arrows pointing to it (2 left, 2 right), each with a
        heading + subheading, plus a bottom heading and 3 labeled circular images. Leave the image empty to hide
        this section entirely on the storefront.
      </p>

      <MediaPicker value={form.infoVisualImage || undefined} onChange={form.setInfoVisualImage} label="Center Image" />

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Top Heading (HTML allowed)</span>
        <textarea
          value={form.infoVisualTopHeading}
          onChange={(e) => form.setInfoVisualTopHeading(e.target.value)}
          rows={2}
          className={textareaClass}
        />
      </label>

      <div>
        <span className="mb-2 block text-xs font-semibold text-secondary">Arrow Captions</span>
        <div className="grid grid-cols-2 gap-4">
          {form.infoVisualArrows.map((arrow, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-sm border border-border bg-surface-2 p-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                {ARROW_POSITION_LABELS[i]}
              </span>
              <input
                placeholder="Heading"
                value={arrow.heading}
                onChange={(e) => updateArrow(i, "heading", e.target.value)}
                className={inputClass}
              />
              <textarea
                placeholder="Subheading"
                value={arrow.subheading}
                onChange={(e) => updateArrow(i, "subheading", e.target.value)}
                rows={2}
                className={textareaClass}
              />
            </div>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Bottom Heading (HTML allowed)</span>
        <textarea
          value={form.infoVisualBottomHeading}
          onChange={(e) => form.setInfoVisualBottomHeading(e.target.value)}
          rows={2}
          className={textareaClass}
        />
      </label>

      <div>
        <span className="mb-2 block text-xs font-semibold text-secondary">Circular Images (shown in a row)</span>
        <div className="grid grid-cols-3 gap-4">
          {form.infoVisualCircles.map((circle, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-sm border border-border bg-surface-2 p-3">
              <MediaPicker
                value={circle.imageUrl || undefined}
                onChange={(url) => updateCircle(i, "imageUrl", url)}
                label={`Image ${i + 1}`}
              />
              <input
                placeholder="Label"
                value={circle.label}
                onChange={(e) => updateCircle(i, "label", e.target.value)}
                className={inputClass}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
