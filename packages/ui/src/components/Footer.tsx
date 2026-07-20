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
  logoUrl?: string;
  bottomImageUrl?: string;
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
  logoUrl,
  bottomImageUrl,
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
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          // mix-blend-screen: the footer logo asset is white artwork baked
          // onto a solid black background (no alpha channel) — screen blend
          // makes black pixels transparent against the green footer bg
          // while keeping the white mark solid, without needing a
          // re-exported transparent PNG.
          <img src={logoUrl} alt={brandMark} className="h-14 w-auto mix-blend-screen" />
        ) : (
          <div className="font-bengali text-[34px] font-bold text-white">{brandMark}</div>
        )}
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

      {bottomImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        // Source art (1536x1024) is a green-to-torn-paper-to-fade scene, not
        // a pre-cropped strip — a short height forces object-cover to scale
        // the image way up to fill the (very wide) container's width, then
        // crop nearly all of the height away, leaving only a razor-thin,
        // unrecognizable sliver. This height keeps enough of the source
        // visible to actually show the leaf + torn-paper band.
        <img src={bottomImageUrl} alt="" aria-hidden="true" className="mt-[-10px] h-[220px] w-full object-cover" />
      ) : (
        <div
          className="mt-[-10px] h-[220px] bg-gradient-to-b from-[#c6a373] to-[#b48a55]"
          aria-hidden
        />
      )}
    </footer>
  );
}
