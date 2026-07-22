"use client";

import { useState } from "react";
import { FilterCheckboxGroup, FilterDrawer, PlaceholderBanner, ProductCard, type ProductCardProps } from "@amader/ui";
import { AppLink } from "@/components/AppLink";
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
    "href" | "name" | "imageUrl" | "price" | "originalPrice" | "discountLabel" | "packOptions" | "defaultPackValue"
  > & { productId: number })[];
  categories?: ProductListingCategory[];
  tags: ProductListingTag[];
  /** Price bounds across this listing's full (unfiltered) product set — omitted (no slider) if there's nothing to range over. */
  priceBounds?: { min: number; max: number };
}

export function ProductListing({
  basePath,
  filters,
  total,
  pageSize,
  products,
  categories,
  tags,
  priceBounds,
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
    <div className="mx-auto max-w-[1180px] px-5">
      <PlaceholderBanner variant="shopban" className="my-5.5" />

      <div className="flex items-center gap-9 py-2 font-ui text-sm font-medium">
        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          className="flex items-center gap-1.5 lg:hidden"
        >
          {hamburgerIcon}
          Filter
        </button>
        <span className="max-lg:hidden">Filter</span>
        <span className="flex items-center gap-2">
          Sort by :
          <SortSelect basePath={basePath} filters={filters} />
        </span>
      </div>

      <h3 className="my-6 text-center font-ui text-lg font-semibold">
        {total === 0 ? "No Products Found" : `Showing ${rangeStart} - ${rangeEnd} of ${total} Products`}
      </h3>

      <FilterDrawer open={filterOpen} onOpenChange={setFilterOpen} title="Filter" closeLabel="Close filters">
        <div onClick={() => setFilterOpen(false)} className="flex flex-col gap-5">
          {filterGroups}
        </div>
      </FilterDrawer>

      <div className="grid grid-cols-[250px_1fr] gap-7 pb-16 max-lg:grid-cols-1">
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
        </div>
      </div>
    </div>
  );
}
