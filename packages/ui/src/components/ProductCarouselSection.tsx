"use client";

import { ReactNode } from "react";
import type { LinkComponent } from "../lib/link-component";
import { Carousel } from "./Carousel";
import { PillTabs, type PillTabOption } from "./PillTabs";
import { ProductCard, type ProductCardProps } from "./ProductCard";
import { SectionHeading, ViewAllLink } from "./SectionHeading";

export type ProductCarouselItem = Pick<
  ProductCardProps,
  "href" | "name" | "imageUrl" | "price" | "originalPrice" | "discountLabel"
>;

export interface ProductCarouselSectionProps {
  heading: ReactNode;
  products: ProductCarouselItem[];
  viewAllHref?: string;
  viewAllLabel?: string;
  addToCartLabel?: string;
  onAddToCart?: (href: string) => void;
  pillOptions?: PillTabOption[];
  activePill?: string;
  onPillChange?: (value: string) => void;
  linkComponent?: LinkComponent;
}

export function ProductCarouselSection({
  heading,
  products,
  viewAllHref,
  viewAllLabel,
  addToCartLabel,
  onAddToCart,
  pillOptions,
  activePill,
  onPillChange,
  linkComponent,
}: ProductCarouselSectionProps) {
  if (products.length === 0) return null;

  return (
    <section className="py-9">
      <SectionHeading>{heading}</SectionHeading>
      {pillOptions && activePill !== undefined && onPillChange && (
        <PillTabs options={pillOptions} value={activePill} onChange={onPillChange} />
      )}
      <Carousel>
        {products.map((product) => (
          <div key={product.href} className="w-[200px] shrink-0">
            <ProductCard
              {...product}
              addToCartLabel={addToCartLabel}
              onAddToCart={() => onAddToCart?.(product.href)}
              linkComponent={linkComponent}
            />
          </div>
        ))}
      </Carousel>
      {viewAllHref && viewAllLabel && (
        <ViewAllLink href={viewAllHref} linkComponent={linkComponent}>
          {viewAllLabel}
        </ViewAllLink>
      )}
    </section>
  );
}
