"use client";

import { FormEvent, ReactNode, useState } from "react";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { Button } from "./Button";

export interface FooterLinkColumn {
  heading: string;
  links: { label: string; href: string }[];
}

export interface FooterProps {
  brandMark: string;
  newsletterHeading: string;
  newsletterPlaceholder: string;
  subscribeLabel: string;
  onSubscribe?: (email: string) => void;
  columns: FooterLinkColumn[];
  contact: ReactNode;
  rightsLabel: string;
  linkComponent?: LinkComponent;
}

export function Footer({
  brandMark,
  newsletterHeading,
  newsletterPlaceholder,
  subscribeLabel,
  onSubscribe,
  columns,
  contact,
  rightsLabel,
  linkComponent: Link = DefaultLink,
}: FooterProps) {
  const [email, setEmail] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubscribe?.(email);
  }

  return (
    <footer className="relative overflow-hidden bg-green text-[#e2ede2]">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-5 px-5 pb-6 pt-8">
        <h3 className="font-serif text-2xl font-semibold text-white">{newsletterHeading}</h3>
        <form
          onSubmit={handleSubmit}
          className="ml-auto flex min-w-[280px] max-w-[560px] flex-1 items-center rounded-full border border-white/25 bg-white/10 py-1 pl-3.5 pr-1"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={newsletterPlaceholder}
            className="flex-1 bg-transparent px-3.5 font-body text-sm text-white outline-none placeholder:text-[#bcd0bc]"
          />
          <Button type="submit" variant="gold" className="rounded-full">
            {subscribeLabel}
          </Button>
        </form>
      </div>

      <div className="mx-auto h-px max-w-[1180px] bg-gold/40" />

      <div className="relative z-[2] mx-auto grid max-w-[1180px] grid-cols-1 gap-8 px-5 py-9 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1.5fr]">
        <div className="font-bengali text-[34px] font-bold text-white">{brandMark}</div>
        {columns.map((column) => (
          <ul key={column.heading} className="flex flex-col gap-2">
            {column.links.map((link) => (
              <li key={link.href} className="list-disc text-[13.5px] marker:text-[#e2ede2]">
                <Link href={link.href} className="hover:text-gold">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        ))}
        <div className="text-[13px] leading-relaxed text-[#e2ede2]">{contact}</div>
      </div>

      <div className="relative z-[2] mx-auto max-w-[1180px] px-5 pb-4 text-xs text-[#bcd0bc]">
        {rightsLabel}
      </div>

      <div
        className="mt-[-10px] h-[80px] bg-gradient-to-b from-[#c6a373] to-[#b48a55]"
        aria-hidden
      />
    </footer>
  );
}
