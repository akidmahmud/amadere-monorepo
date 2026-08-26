"use client";

import Image from "next/image";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { SlideCarousel } from "./SlideCarousel";

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
// padding (flat, no responsive scale-up), near-full-bleed image tiles (only a
// ~2.5px inset, not a padded icon-in-a-box look) with 20px corner radius,
// 16px gap, and a dark-ink medium-weight label — this section's heading is
// NOT the green/extrabold treatment used elsewhere on our site, because the
// reference itself doesn't color it either.
export function FeaturedCategoriesSection({
  heading = "Featured Categories",
  items,
  linkComponent: Link = DefaultLink,
}: FeaturedCategoriesSectionProps) {
  if (items.length === 0) return null;

  return (
    <section className="py-4">
      <div className="mx-auto max-w-[1440px] px-4 md:px-6">
        <h2 className="mb-6 text-center font-serif text-[22px] font-semibold text-green md:text-[30px]">
          {heading}
        </h2>

        {/* Category tiles are much narrower than product cards, so a slide
            holds more of them than the products carousel's 5 — the basis
            ladder is the only thing that decides that, and SlideCarousel
            measures the result rather than being told it. */}
        <SlideCarousel
          slotClassName="basis-1/3 sm:basis-1/4 md:basis-1/6 xl:basis-1/8"
          gapPx={16}
          autoplayMs={4000}
          ariaLabel={heading}
        >
          {items.map((item) => (
            <Link key={item.href} href={item.href} className="group block text-center">
              <div className="mx-auto flex aspect-square w-full max-w-[140px] items-center justify-center overflow-hidden rounded-[20px] bg-white p-0.5 transition-transform duration-200 group-hover:-translate-y-1">
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
        </SlideCarousel>
      </div>
    </section>
  );
}
