"use client";

import * as RadixAccordion from "@radix-ui/react-accordion";
import { cn } from "../lib/cn";

export interface FaqAccordionItem {
  question: string;
  answer: string;
}

export interface FaqAccordionProps {
  items: FaqAccordionItem[];
  className?: string;
}

const chevron = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    className="h-4 w-4 shrink-0 text-green transition-transform duration-200 group-data-[state=open]:rotate-180"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export function FaqAccordion({ items, className }: FaqAccordionProps) {
  if (items.length === 0) return null;

  return (
    <RadixAccordion.Root type="single" collapsible className={cn("space-y-2.5", className)}>
      {items.map((item, i) => (
        <RadixAccordion.Item
          key={i}
          value={String(i)}
          className="overflow-hidden rounded-brand border border-line bg-white"
        >
          <RadixAccordion.Header>
            <RadixAccordion.Trigger className="group flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left font-ui text-sm font-medium text-ink">
              {item.question}
              {chevron}
            </RadixAccordion.Trigger>
          </RadixAccordion.Header>
          <RadixAccordion.Content className="px-4 pb-3.5 font-body text-sm text-muted data-[state=closed]:hidden">
            {item.answer}
          </RadixAccordion.Content>
        </RadixAccordion.Item>
      ))}
    </RadixAccordion.Root>
  );
}
