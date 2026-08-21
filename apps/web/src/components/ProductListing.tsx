"use client";

import { useEffect, useState } from "react";
import { FilterCheckboxGroup, FilterDrawer, PlaceholderBanner, SiteProductCard } from "@amader/ui";
import { AppBreadcrumb } from "@/components/AppBreadcrumb";
import { AppLink } from "@/components/AppLink";
import { PerPageSelect } from "@/components/PerPageSelect";
import { PlpPager } from "@/components/PlpPager";
import { PriceFilter } from "@/components/PriceFilter";
import { SortSelect } from "@/components/SortSelect";
import { useCardAddToCart } from "@/hooks/useCardAddToCart";
import { buildPlpHref, type PlpFilters } from "@/lib/plp";
import { pushEcommerceEvent, cardToGa4Item } from "@/lib/analytics-events";
import type { ProductCardData } from "@/lib/product-card-mapper";

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

export interface ProductListingCollection {
  id: number;
  name: string;
}

export interface ProductListingBrand {
  id: number;
  slug: string;
  name: string;
}

export interface ProductListingProps {
  basePath: string;
  filters: PlpFilters;
  total: number;
  pageSize: number;
  products: ProductCardData[];
  categories?: ProductListingCategory[];
  collections?: ProductListingCollection[];
  brands?: ProductListingBrand[];
  /** Price bounds across this listing's full (unfiltered) product set — omitted (no slider) if there's nothing to range over. */
  priceBounds?: { min: number; max: number };
  /** Category pages now show their own real banner (admin-uploaded) above
   * this listing — skip the decorative placeholder there so the page
   * doesn't show two gray boxes, one real and one dead. */
  hidePlaceholderBanner?: boolean;
  /** Page title + "Home › X" breadcrumb above the toolbar. Omitted (no
   * header) when a caller doesn't pass one, rather than guessing a title. */
  title?: string;
  breadcrumbItems?: { label: string; href?: string }[];
  /** Overrides the outer wrapper's max-width/side-padding classes — default
   * matches every other PLP route (`/products`, `/categories/*`, etc.). */
  containerClassName?: string;
}

const DEFAULT_CONTAINER_CLASSNAME = "mx-auto max-w-[1180px] px-5";

// Pixel-matched to ghorerbazar.com/collections/honey-2: each sidebar facet is
// its own boxed white widget (not one shared card), a toolbar that sits
// beside the sidebar (not spanning its width) with a plain "Sort By :" +
// per-page select, a grid of the site's one shared ProductCard (same
// component homepage/search/PDP use), and a bottom "Showing X - Y of Z
// results" line under pagination.
export function ProductListing({
  basePath,
  filters,
  total,
  pageSize,
  products,
  categories,
  collections,
  brands,
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

  // view_item_list — fires whenever this page's actual product set changes
  // (filter/sort/page navigation genuinely is a new "list view" in GA4's
  // model, not just this component's first mount).
  const listId = basePath.replace(/^\//, "") || "products";
  const listName = title ?? "Products";
  useEffect(() => {
    if (products.length === 0) return;
    pushEcommerceEvent("view_item_list", {
      item_list_id: listId,
      item_list_name: listName,
      items: products.map((p, i) => cardToGa4Item(p, { index: i, listId, listName })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, listId, listName]);

  const widget = (content: React.ReactNode, key: string) => (
    <div key={key} className="mb-1.5 rounded bg-white p-3 shadow-[0_1px_1px_rgba(0,0,0,.1)]">
      {content}
    </div>
  );

  const filterGroups = (
    <>
      {collections && collections.length > 0 &&
        widget(
          <FilterCheckboxGroup
            heading="Filter By Collection"
            linkComponent={AppLink}
            options={collections.map((collection) => ({
              label: collection.name,
              active: filters.collectionIds.includes(collection.id),
              href: buildPlpHref(basePath, {
                ...filters,
                collectionIds: toggleId(filters.collectionIds, collection.id),
                page: 1,
              }),
            }))}
          />,
          "collection",
        )}
      {categories && categories.length > 0 &&
        widget(
          <FilterCheckboxGroup
            heading="Filter By Category"
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
          />,
          "category",
        )}
      {priceBounds &&
        widget(<PriceFilter basePath={basePath} filters={filters} min={priceBounds.min} max={priceBounds.max} />, "price")}
      {brands && brands.length > 0 &&
        widget(
          <FilterCheckboxGroup
            heading="Brands"
            linkComponent={AppLink}
            options={brands.map((brand) => ({
              label: brand.name,
              active: filters.brandId === brand.id,
              href: buildPlpHref(basePath, {
                ...filters,
                brandId: filters.brandId === brand.id ? undefined : brand.id,
                page: 1,
              }),
            }))}
          />,
          "brand",
        )}
    </>
  );

  return (
    <div className={containerClassName}>
      {!hidePlaceholderBanner && <PlaceholderBanner variant="shopban" className="my-5.5" />}

      {title && (
        <div className="flex items-center justify-between py-3">
          <h1 className="font-header text-base font-semibold text-header-ink sm:text-xl">{title}</h1>
          {breadcrumbItems && <AppBreadcrumb items={breadcrumbItems} />}
        </div>
      )}

      <div className="grid grid-cols-[290px_1fr] gap-6 pb-10 max-lg:grid-cols-1">
        <aside className="self-start max-lg:hidden">{filterGroups}</aside>

        <div>
          <div className="mb-5 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-4">
              <button
                type="button"
                onClick={() => setFilterOpen(true)}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-header-green px-3 py-1.5 font-ui text-[11px] font-semibold text-header-green lg:hidden"
              >
                {hamburgerIcon}
                Filters
              </button>
              <span className="flex min-w-0 items-center gap-2 font-ui text-xs text-ink">
                <span className="max-sm:hidden">Sort By :</span>
                <SortSelect basePath={basePath} filters={filters} />
              </span>
            </div>
            <PerPageSelect basePath={basePath} filters={filters} />
          </div>

          <FilterDrawer open={filterOpen} onOpenChange={setFilterOpen} title="Filter" closeLabel="Close filters">
            <div onClick={() => setFilterOpen(false)} className="flex flex-col gap-3">
              {filterGroups}
            </div>
          </FilterDrawer>

          {products.length === 0 ? (
            <p className="py-16 text-center font-body text-muted">No products match these filters.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              {products.map((product, i) => (
                <SiteProductCard
                  key={product.href}
                  {...product}
                  linkComponent={AppLink}
                  addToCartPending={isPending && pendingProductId === product.productId}
                  onAddToCart={(packValue) => handleAddToCart(product.productId, packValue)}
                  onSelect={() =>
                    pushEcommerceEvent("select_item", {
                      item_list_id: listId,
                      item_list_name: listName,
                      items: [cardToGa4Item(product, { index: i, listId, listName })],
                    })
                  }
                />
              ))}
            </div>
          )}
          <PlpPager basePath={basePath} filters={filters} totalPages={totalPages} />
          {products.length > 0 && (
            <p className="mt-3 text-center font-ui text-sm text-muted">
              Showing {rangeStart} - {rangeEnd} of {total} results
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
