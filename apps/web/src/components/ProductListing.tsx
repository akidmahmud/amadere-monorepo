import {
  FilterCheckboxGroup,
  Pager,
  PlaceholderBanner,
  ProductCard,
  type ProductCardProps,
} from "@amader/ui";
import { AppLink } from "@/components/AppLink";
import { SortSelect } from "@/components/SortSelect";
import { buildPlpHref, type PlpFilters } from "@/lib/plp";

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
  products: Pick<ProductCardProps, "href" | "name" | "imageUrl" | "price" | "originalPrice" | "discountLabel">[];
  categories?: ProductListingCategory[];
  tags: ProductListingTag[];
}

export function ProductListing({
  basePath,
  filters,
  total,
  pageSize,
  products,
  categories,
  tags,
}: ProductListingProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (filters.page - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, filters.page * pageSize);

  return (
    <div className="mx-auto max-w-[1180px] px-5">
      <PlaceholderBanner variant="shopban" className="my-5.5" />

      <div className="flex items-center gap-9 py-2 font-ui text-sm font-medium">
        <span>Filter</span>
        <span className="flex items-center gap-2">
          Sort by :
          <SortSelect
            value={filters.sort}
            buildHref={(sort) => buildPlpHref(basePath, { ...filters, sort, page: 1 })}
          />
        </span>
      </div>

      <h3 className="my-6 text-center font-ui text-lg font-semibold">
        {total === 0 ? "No Products Found" : `Showing ${rangeStart} - ${rangeEnd} of ${total} Products`}
      </h3>

      <div className="grid grid-cols-[250px_1fr] gap-7 pb-16 max-lg:grid-cols-1">
        <aside className="sticky top-[130px] self-start rounded-brand bg-beige p-5 max-lg:static">
          {categories && categories.length > 0 && (
            <FilterCheckboxGroup
              heading="Category"
              linkComponent={AppLink}
              options={categories.map((category) => ({
                label: category.name,
                count: category.productCount,
                active: filters.categoryId === category.id,
                href: buildPlpHref(basePath, {
                  ...filters,
                  categoryId: filters.categoryId === category.id ? undefined : category.id,
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
                active: filters.tagId === tag.id,
                href: buildPlpHref(basePath, {
                  ...filters,
                  tagId: filters.tagId === tag.id ? undefined : tag.id,
                  page: 1,
                }),
              }))}
            />
          )}
        </aside>

        <div>
          {products.length === 0 ? (
            <p className="py-16 text-center font-body text-muted">No products match these filters.</p>
          ) : (
            <div className="grid grid-cols-4 gap-4.5 max-lg:grid-cols-3 max-sm:grid-cols-2">
              {products.map((product) => (
                <ProductCard key={product.href} {...product} linkComponent={AppLink} />
              ))}
            </div>
          )}
          <Pager
            page={filters.page}
            totalPages={totalPages}
            linkComponent={AppLink}
            buildHref={(page) => buildPlpHref(basePath, { ...filters, page })}
          />
        </div>
      </div>
    </div>
  );
}
