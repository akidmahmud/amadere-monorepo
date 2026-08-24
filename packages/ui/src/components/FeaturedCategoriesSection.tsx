"use client";


import { InfiniteMarquee } from "./InfiniteMarquee";
import Image from "next/image";
import { DefaultLink, type LinkComponent } from "../lib/link-component";

export interface FeaturedCategoryItem {
  href: string;
  name: string;
  imageUrl?: string;
}

export interface FeaturedCategoriesSectionProps {
  heading?: string;
  items: FeaturedCategoryItem[];
  linkComponent?: LinkComponent;
}

// Pixel-matched to ghorerbazar.com's `.category.style-3.section-padding`
// (mobile measured first, then desktop — per explicit request): 16px section
// padding (flat, no responsive scale-up), near-full-bleed 105px/100px
// image tiles (only a ~2.5px inset, not a padded icon-in-a-box look) with
// 20px corner radius, 16px gap, dark-ink medium-weight heading (this
// section's own heading is NOT the green/extrabold treatment used
// elsewhere on our site — the reference itself doesn't color it either),
// and small solid-circle arrows.
export function FeaturedCategoriesSection({ heading = "Featured Categories", items, linkComponent: Link = DefaultLink }: FeaturedCategoriesSectionProps) {
  if (items.length === 0) return null;

  return (
    <section className="py-4">
      <div className="mx-auto max-w-[1440px] px-4 md:px-6">
        <h2 className="mb-6 text-center font-serif text-[22px] font-semibold text-green md:text-[30px]">
          {heading}
        </h2>

        {/* Continuous loop rather than the previous step-and-rewind
            carousel, which visibly jumped back to the start. Arrows are gone
            with it: they fight an always-moving track, and hovering already
            pauses the row so a card can be read and clicked. */}
        {/* 145px tiles: ~12 needed to overflow a wide screen. */}
        <InfiniteMarquee secondsPerItem={9} gapPx={16} minPerCopy={12} ariaLabel={heading}>
          {items.map((item) => (
            <Link key={item.href} href={item.href} className="group block basis-[105px] text-center md:basis-[145px]">
              <div className="flex h-[100px] w-[100px] items-center justify-center overflow-hidden rounded-[20px] bg-white p-0.5 transition-transform duration-200 group-hover:-translate-y-1 md:h-[140px] md:w-[140px]">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt=""
                    width={140}
                    height={140}
                    className="h-full w-full rounded-[20px] object-contain"
                  />
                ) : (
                  <div className="h-full w-full rounded-[20px] bg-beige" />
                )}
              </div>
              <div className="mt-2.5 font-body text-sm font-medium text-header-ink group-hover:text-header-green">
                {item.name}
              </div>
            </Link>
          ))}
        </InfiniteMarquee>
      </div>
    </section>
  );
}
