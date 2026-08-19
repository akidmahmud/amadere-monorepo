"use client";

import { useState } from "react";

export interface FaqAccordionItem {
  question: string;
  answer: string;
}

// Plus that turns into a minus: the vertical stroke rotates onto the
// horizontal one, so one icon covers both states with no swap.
const plusMinus = (isOpen: boolean) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <line
      x1="12"
      y1="5"
      x2="12"
      y2="19"
      className={`origin-center transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
    />
  </svg>
);

// One open at a time — clicking an already-open question closes it, clicking
// another closes the previous one and opens the new one. First question
// starts open so the tab never looks empty the instant it's selected.
export function FaqAccordion({ faqs }: { faqs: FaqAccordionItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="flex flex-col divide-y divide-line">
      {faqs.map((faq, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={i} className="py-3.5 first:pt-0 last:pb-0">
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <span className="font-body text-sm font-bold text-text">{faq.question}</span>
              <span
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-green"
              >
                {plusMinus(isOpen)}
              </span>
            </button>
            {/* grid-template-rows 0fr→1fr — animates height to "auto" without
                JS measuring the content (no ref/scrollHeight needed, unlike
                ProductTabs' own ExpandableContent). min-h-0 on the grid item
                is required for this trick to actually reach zero height —
                grid items default to min-height:auto (at least as tall as
                their content) regardless of the track's own 0fr sizing,
                otherwise the "collapsed" state just silently stays expanded. */}
            <div
              className={`grid overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out ${isOpen ? "mt-2 grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            >
              <div className="min-h-0 overflow-hidden">
                <p className="font-body text-sm leading-relaxed text-secondary">{faq.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
