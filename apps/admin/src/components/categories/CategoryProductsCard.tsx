"use client";

import { useMemo, useState } from "react";
import { Card, Icon } from "@amader/admin-ui";
import { usePickerProducts } from "@/hooks/usePickers";

/**
 * Choose which products sit in a category, and in what order.
 *
 * The membership link is not new — the product form has always written it from
 * the other side, which is where every existing assignment came from. What was
 * missing is this direction, and any way to say which product should lead.
 *
 * **Array order is the priority.** Position 1 is what the storefront shows
 * first under the Default sort. Keeping the list contiguous means the numbers
 * shown here are exactly the numbers stored, with no gaps to explain.
 */
export function CategoryProductsCard({
  selected,
  onChange,
}: {
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const { data: products, isLoading } = usePickerProducts();
  const [search, setSearch] = useState("");

  const all = useMemo(() => products ?? [], [products]);
  const byId = useMemo(() => new Map(all.map((p) => [p.id, p])), [all]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? all.filter((p) => p.label.toLowerCase().includes(q)) : all;
  }, [all, search]);

  function toggle(id: number) {
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );
  }

  /** Move a product to a 1-based priority, closing the gap it leaves behind. */
  function setPriority(id: number, oneBased: number) {
    const target = Math.min(Math.max(1, oneBased), selected.length) - 1;
    const without = selected.filter((x) => x !== id);
    onChange([...without.slice(0, target), id, ...without.slice(target)]);
  }

  function move(id: number, delta: number) {
    setPriority(id, selected.indexOf(id) + 1 + delta);
  }

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-text">Products</h3>
            <p className="text-xs text-secondary">
              {selected.length} in this category. Priority 1 shows first on the
              storefront under the Default sort.
            </p>
          </div>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs font-semibold text-danger hover:underline"
            >
              Remove all
            </button>
          )}
        </div>

        {/* Ordered list first: this is the part that carries meaning, and it
            is what the storefront will actually render. */}
        {selected.length > 0 && (
          <div className="flex flex-col gap-1.5 rounded-sm border border-border bg-surface-2 p-2">
            {selected.map((id, index) => {
              const product = byId.get(id);
              return (
                <div
                  key={id}
                  className="flex items-center gap-2 rounded-sm bg-surface px-2 py-1.5"
                >
                  <input
                    type="number"
                    min={1}
                    max={selected.length}
                    value={index + 1}
                    onChange={(e) => setPriority(id, Number(e.target.value))}
                    aria-label={`Priority for ${product?.label ?? `product ${id}`}`}
                    className="num h-8 w-14 flex-none rounded-sm border border-border bg-surface px-2 text-center text-xs font-semibold text-text outline-none focus:border-brand-500"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-text">
                    {/* A product assigned here but past the picker's page is
                        still a real membership — show its id rather than
                        dropping it silently. */}
                    {product?.label ?? `Product #${id}`}
                  </span>
                  <div className="flex flex-none items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => move(id, -1)}
                      disabled={index === 0}
                      aria-label="Move up"
                      className="grid h-7 w-7 place-items-center rounded-sm text-secondary hover:bg-surface-2 hover:text-text disabled:opacity-30"
                    >
                      <Icon name="keyboard_arrow_up" size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(id, 1)}
                      disabled={index === selected.length - 1}
                      aria-label="Move down"
                      className="grid h-7 w-7 place-items-center rounded-sm text-secondary hover:bg-surface-2 hover:text-text disabled:opacity-30"
                    >
                      <Icon name="keyboard_arrow_down" size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggle(id)}
                      aria-label="Remove from category"
                      className="grid h-7 w-7 place-items-center rounded-sm text-danger hover:bg-danger/10"
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="relative">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products to add…"
            className="h-10 w-full rounded-sm border border-border bg-surface pl-9 pr-3 text-sm text-text outline-none focus:border-brand-500"
          />
          <Icon
            name="search"
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
        </div>

        <div className="max-h-72 overflow-y-auto rounded-sm border border-border">
          {isLoading && (
            <p className="p-4 text-xs text-secondary">Loading products…</p>
          )}
          {!isLoading && filtered.length === 0 && (
            <p className="p-4 text-xs text-secondary">
              No products match that search.
            </p>
          )}
          {filtered.map((p) => {
            const index = selected.indexOf(p.id);
            return (
              <label
                key={p.id}
                className="flex cursor-pointer items-center gap-2.5 border-b border-border px-3 py-2 last:border-b-0 hover:bg-surface-2"
              >
                <input
                  type="checkbox"
                  checked={index !== -1}
                  onChange={() => toggle(p.id)}
                  className="flex-none"
                />
                <span className="min-w-0 flex-1 truncate text-sm text-text">
                  {p.label}
                </span>
                {index !== -1 && (
                  <span className="flex-none rounded-pill bg-brand-500/15 px-2 py-0.5 text-[0.68rem] font-bold text-brand-600 dark:text-brand-400">
                    #{index + 1}
                  </span>
                )}
                {p.price && (
                  <span className="flex-none text-xs tabular-nums text-secondary">
                    ৳{p.price}
                  </span>
                )}
              </label>
            );
          })}
        </div>

        {/* The picker endpoint returns the 100 most recent products. Said out
            loud rather than left as a silent ceiling, because a shop that grows
            past it would otherwise just stop seeing its oldest products here. */}
        {all.length >= 100 && (
          <p className="text-xs text-muted">
            Showing the 100 most recent products. Assign older ones from the
            product&apos;s own page.
          </p>
        )}
      </div>
    </Card>
  );
}
