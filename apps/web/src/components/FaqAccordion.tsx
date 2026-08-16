"use client";

import { useState } from "react";

export interface FaqAccordionItem {
  question: string;
  answer: string;
}

const chevron = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
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
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-green transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
              >
                {chevron}
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
