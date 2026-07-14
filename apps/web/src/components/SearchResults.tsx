"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Pager, ProductCard } from "@amader/ui";
import { useRouter } from "@/i18n/navigation";
import { AppLink } from "@/components/AppLink";
import { toApiLocale } from "@/lib/api-locale";
import { toDisplayImageUrl } from "@/lib/media";
import { useSearchProducts } from "@/hooks/useSearch";
import { useCardAddToCart } from "@/hooks/useCardAddToCart";

const PAGE_SIZE = 24;

export function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const locale = toApiLocale(useLocale());
  const router = useRouter();
  const [input, setInput] = useState(query);
  const { data, isLoading, isFetching } = useSearchProducts(query, locale, page);

  const { handleAddToCart, isPending, pendingProductId } = useCardAddToCart();

  const products = (data?.items ?? []).map((hit) => ({
    href: `/products/${hit.slug}`,
    productId: hit.id,
    name: hit.name,
    imageUrl: toDisplayImageUrl(hit.primaryImageUrl),
    price: hit.salePrice ?? hit.price ?? "0",
    originalPrice: hit.salePrice ? (hit.price ?? undefined) : undefined,
  }));

  return (
    <div className="mx-auto max-w-[1180px] px-5 py-9">
      <form
        className="mx-auto mb-8 flex max-w-lg gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(`/search?q=${encodeURIComponent(input)}`);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search products…"
          className="w-full rounded-[10px] border border-line bg-white px-3.5 py-2.5 font-body text-sm text-ink outline-none focus:border-green"
        />
      </form>

      {query.trim().length < 2 ? (
        <p className="text-center font-body text-sm text-muted">Type at least 2 characters to search.</p>
      ) : isLoading ? (
        <p className="text-center font-body text-sm text-muted">Searching…</p>
      ) : products.length === 0 ? (
        <p className="text-center font-body text-sm text-muted">No products found for &quot;{query}&quot;.</p>
      ) : (
        <>
          <p className="mb-6 text-center font-ui text-sm text-muted">
            {data?.total} result{data?.total === 1 ? "" : "s"} for &quot;{query}&quot;
            {isFetching && " …"}
          </p>
          <div className="grid grid-cols-4 gap-4.5 max-lg:grid-cols-3 max-sm:grid-cols-2">
            {products.map((product) => (
              <ProductCard
                key={product.href}
                {...product}
                addToCartPending={isPending && pendingProductId === product.productId}
                onAddToCart={() => handleAddToCart(product.productId)}
                linkComponent={AppLink}
              />
            ))}
          </div>
          <Pager
            page={page}
            totalPages={Math.ceil((data?.total ?? 0) / PAGE_SIZE)}
            buildHref={(p) => `/search?q=${encodeURIComponent(query)}${p > 1 ? `&page=${p}` : ""}`}
            linkComponent={AppLink}
          />
        </>
      )}
    </div>
  );
}
