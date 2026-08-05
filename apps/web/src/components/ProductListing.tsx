"use client";

import { useState } from "react";
import { FilterCheckboxGroup, FilterDrawer, PlaceholderBanner, ProductCard, type ProductCardProps } from "@amader/ui";
import { AppBreadcrumb } from "@/components/AppBreadcrumb";
import { AppLink } from "@/components/AppLink";
import { PerPageSelect } from "@/components/PerPageSelect";
import { PlpPager } from "@/components/PlpPager";
import { PriceFilter } from "@/components/PriceFilter";
import { SortSelect } from "@/components/SortSelect";
import { useCardAddToCart } from "@/hooks/useCardAddToCart";
import { buildPlpHref, type PlpFilters } from "@/lib/plp";

const hamburgerIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
    <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
  </svg>
);

function toggleId(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((existing) => existing !== id) : [...ids, id];
}

export interface ProductListingCategory {
  id: number;
  slug: string;
  name: string;
  productCount: number;
}

export interface ProductListingTag {
  id: number;
  name: string;
}

export interface ProductListingProps {
  basePath: string;
  filters: PlpFilters;
  total: number;
  pageSize: number;
  products: (Pick<
    ProductCardProps,
    "href" | "name" | "imageUrl" | "price" | "originalPrice" | "discountLabel" | "flagLabel" | "saleEndsAt" | "packOptions" | "defaultPackValue"
  > & { productId: number })[];
  categories?: ProductListingCategory[];
  tags: ProductListingTag[];
  /** Price bounds across this listing's full (unfiltered) product set — omitted (no slider) if there's nothing to range over. */
  priceBounds?: { min: number; max: number };
  /** Category pages now show their own real banner (admin-uploaded) above
   * this listing — skip the decorative placeholder there so the page
   * doesn't show two gray boxes, one real and one dead. */
  hidePlaceholderBanner?: boolean;
  /** Pixel-matched to ghorerbazar.com's offer-zone collection page: a page
   * title + "Home › X" breadcrumb above the toolbar. Omitted (no header)
   * when a caller doesn't pass one, rather than guessing a title. */
  title?: string;
  breadcrumbItems?: { label: string; href?: string }[];
  /** Overrides the outer wrapper's max-width/side-padding classes — default
   * matches every other PLP route (`/products`, `/categories/*`, etc.). */
  containerClassName?: string;
}

const DEFAULT_CONTAINER_CLASSNAME = "mx-auto max-w-[1180px] px-5";

export function ProductListing({
  basePath,
  filters,
  total,
  pageSize,
  products,
  categories,
  tags,
  priceBounds,
  hidePlaceholderBanner,
  title,
  breadcrumbItems,
  containerClassName = DEFAULT_CONTAINER_CLASSNAME,
}: ProductListingProps) {
  const { handleAddToCart, isPending, pendingProductId } = useCardAddToCart();
  const [filterOpen, setFilterOpen] = useState(false);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (filters.page - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, filters.page * pageSize);

  const filterGroups = (
    <>
      {priceBounds && (
        <PriceFilter basePath={basePath} filters={filters} min={priceBounds.min} max={priceBounds.max} />
      )}
      {categories && categories.length > 0 && (
        <FilterCheckboxGroup
          heading="Category"
          linkComponent={AppLink}
          options={categories.map((category) => ({
            label: category.name,
            count: category.productCount,
            active: filters.categoryIds.includes(category.id),
            href: buildPlpHref(basePath, {
              ...filters,
              categoryIds: toggleId(filters.categoryIds, category.id),
              page: 1,
            }),
          }))}
        />
      )}
      {tags.length > 0 && (
        <FilterCheckboxGroup
          heading="Health Concern"
          linkComponent={AppLink}
          options={tags.map((tag) => ({
            label: tag.name,
            active: filters.tagIds.includes(tag.id),
            href: buildPlpHref(basePath, {
              ...filters,
              tagIds: toggleId(filters.tagIds, tag.id),
              page: 1,
            }),
          }))}
        />
      )}
    </>
  );

  return (
    <div className={containerClassName}>
      {!hidePlaceholderBanner && <PlaceholderBanner variant="shopban" className="my-5.5" />}

      {/* Pixel-matched to ghorerbazar.com's `.breadcrumb-nav`: 12px padding
          top and bottom, no background of its own. */}
      {title && (
        <div className="py-3">
          <h1 className="font-header text-base font-semibold text-header-ink sm:text-xl">{title}</h1>
          {breadcrumbItems && <AppBreadcrumb items={breadcrumbItems} />}
        </div>
      )}

      {/* Pixel-matched to ghorerbazar.com's `.toolbox` (offer-zone collection
          page): bordered white bar, outlined Filters button + Sort select on
          the left, per-page Show select on the right — colors are Amader's
          own green, not their orange. */}
      <div className="mb-6 flex items-center justify-between gap-2 rounded border border-line bg-white p-2.5 sm:p-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            className="flex shrink-0 items-center gap-1.5 rounded border-2 border-header-green px-2 py-1.5 font-ui text-[11px] font-semibold text-header-green sm:gap-2 sm:px-2.5 sm:py-2 sm:text-xs lg:hidden"
          >
            {hamburgerIcon}
            Filters
          </button>
          <span className="flex min-w-0 items-center gap-2 font-ui text-xs text-muted">
            <span className="max-sm:hidden">Sort By :</span>
            <SortSelect basePath={basePath} filters={filters} />
          </span>
        </div>
        <PerPageSelect basePath={basePath} filters={filters} />
      </div>

      <FilterDrawer open={filterOpen} onOpenChange={setFilterOpen} title="Filter" closeLabel="Close filters">
        <div onClick={() => setFilterOpen(false)} className="flex flex-col gap-5">
          {filterGroups}
        </div>
      </FilterDrawer>

      {/* Pixel-matched to ghorerbazar.com's `.shop-content.row.pb-8`: 40px
          bottom padding on the sidebar+grid row. */}
      <div className="grid grid-cols-[260px_1fr] gap-7 pb-10 max-lg:grid-cols-1">
        <aside className="sticky top-[130px] self-start rounded-brand bg-beige p-5 max-lg:hidden">
          {filterGroups}
        </aside>

        <div>
          {products.length === 0 ? (
            <p className="py-16 text-center font-body text-muted">No products match these filters.</p>
          ) : (
            <div className="grid grid-cols-4 gap-4.5 max-lg:grid-cols-3 max-sm:grid-cols-2">
              {products.map((product) => (
                <ProductCard
                  key={product.href}
                  {...product}
                  addToCartPending={isPending && pendingProductId === product.productId}
                  onAddToCart={(packValue) => handleAddToCart(product.productId, packValue)}
                  linkComponent={AppLink}
                />
              ))}
            </div>
          )}
          <PlpPager basePath={basePath} filters={filters} totalPages={totalPages} />
          {products.length > 0 && (
            <p className="mt-3 text-center font-ui text-[11px] text-muted">
              Showing {rangeStart} - {rangeEnd} of {total} results
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
