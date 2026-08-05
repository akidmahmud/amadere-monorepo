"use client";

import type { ProductFormState } from "./useProductFormState";

const inputClass = "h-9 w-full rounded-sm border border-border bg-surface px-2.5 text-sm text-text outline-none focus:border-brand-500";
const textareaClass = "w-full rounded-sm border border-border bg-surface p-2.5 text-sm text-text outline-none focus:border-brand-500";

export function ProductFaqCard({ form }: { form: ProductFormState }) {
  function update(index: number, patch: Partial<{ question: string; answer: string }>) {
    form.setFaqs(form.faqs.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function remove(index: number) {
    form.setFaqs(form.faqs.filter((_, i) => i !== index));
  }

  return (
    <div className="rounded-card border border-border bg-surface p-[18px]">
      <div className="mb-3.5 flex items-center justify-between">
        <h3 className="text-[0.9rem] font-extrabold text-text">FAQ (optional — rendered as the product page&apos;s FAQ tab)</h3>
        <button
          type="button"
          onClick={() => form.setFaqs([...form.faqs, { question: "", answer: "" }])}
          className="grid h-7 w-7 place-items-center rounded-full bg-brand-500 text-base font-bold leading-none text-white"
          aria-label="Add question"
          title="Add question"
        >
          +
        </button>
      </div>
      {form.faqs.length === 0 && <p className="text-[0.8rem] text-muted">No questions yet — click + to add one.</p>}
      <div className="flex flex-col gap-3">
        {form.faqs.map((faq, i) => (
          <div key={i} className="rounded-inner border border-border p-3">
            <div className="mb-2 flex items-start gap-2">
              <input
                value={faq.question}
                onChange={(e) => update(i, { question: e.target.value })}
                placeholder="Question"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => remove(i)}
                className="grid h-9 w-9 flex-none place-items-center rounded-sm border border-border text-base font-bold text-muted hover:text-danger"
                aria-label="Remove question"
                title="Remove question"
              >
                ×
              </button>
            </div>
            <textarea
              value={faq.answer}
              onChange={(e) => update(i, { answer: e.target.value })}
              placeholder="Answer"
              rows={2}
              className={textareaClass}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
