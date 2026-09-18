"use client";
import { useState } from "react";
import { useProductCosts, useVariantCosts } from "@/hooks/useProfit";
import {
  useAddCost,
  useConfirmCost,
  useCostHistory,
  useRemoveCost,
  type CostHistoryRow,
} from "@/hooks/useSalesReportV2";
import { COLORS, dmy, tk } from "./format";
import { Tag } from "./Tags";
import { addDays } from "./useReportFilters";

function History({
  rows,
  canEdit,
}: {
  rows: CostHistoryRow[];
  canEdit: boolean;
}) {
  const confirm = useConfirmCost();
  const remove = useRemoveCost();
  const today = new Date(Date.now() + 6 * 3600_000).toISOString().slice(0, 10);
  const current = [...rows]
    .filter((r) => r.effectiveFrom <= today)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  if (!rows.length)
    return (
      <span className="text-[13px]" style={{ color: COLORS.loss }}>
        No cost yet
      </span>
    );
  return (
    <div className="flex flex-wrap gap-1.5">
      {rows.map((r, i) => (
        <span
          key={r.id}
          className="inline-flex items-center gap-1.5 rounded-md border px-2 py-px text-[13.5px]"
          style={
            r === current
              ? { borderColor: COLORS.greenLine, background: COLORS.greenWash }
              : { borderColor: COLORS.line, background: "#fff" }
          }
        >
          from {dmy(r.effectiveFrom)}: <b>{tk(Number(r.cost))}</b>
          {r.costPriceUnit && (
            <span className="text-xs" style={{ color: COLORS.muted }}>
              {r.costPriceUnit.replace("PER_", "per ").toLowerCase()}
            </span>
          )}
          {r.confirmed ? (
            <Tag>Confirmed</Tag>
          ) : (
            <Tag tone="info">Unconfirmed</Tag>
          )}
          {canEdit && (
            <button
              type="button"
              className="text-sm"
              style={{ color: COLORS.green }}
              onClick={() =>
                confirm.mutate({ id: r.id, confirmed: !r.confirmed })
              }
            >
              {r.confirmed ? "Mark unconfirmed" : "Confirm"}
            </button>
          )}
          {canEdit && i > 0 && (
            <button
              type="button"
              aria-label="Remove cost"
              className="text-sm"
              style={{ color: COLORS.green }}
              onClick={() => remove.mutate(r.id)}
            >
              remove
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

function AddCost({
  productId,
  variantId,
}: {
  productId: number;
  variantId: number | null;
}) {
  const add = useAddCost();
  const tomorrow = addDays(
    new Date(Date.now() + 6 * 3600_000).toISOString().slice(0, 10),
    1,
  );
  const [from, setFrom] = useState(tomorrow);
  const [cost, setCost] = useState("");
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <input
        type="date"
        aria-label="New cost from"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        className="rounded-md border px-1.5 py-0.5 text-sm"
        style={{ borderColor: COLORS.line }}
      />
      <input
        type="number"
        min={0}
        aria-label="New cost"
        placeholder="৳"
        value={cost}
        onChange={(e) => setCost(e.target.value)}
        className="w-[88px] rounded-md border px-1.5 py-0.5 text-right text-sm"
        style={{ borderColor: COLORS.line }}
      />
      <button
        type="button"
        disabled={add.isPending || cost === "" || Number(cost) < 0}
        onClick={() =>
          add.mutate(
            { productId, variantId, cost: Number(cost), effectiveFrom: from },
            { onSuccess: () => setCost("") },
          )
        }
        className="rounded-lg border px-3 py-0.5 text-sm font-medium disabled:opacity-40"
        style={{ borderColor: COLORS.line }}
      >
        Add cost
      </button>
    </span>
  );
}

function ProductCosts({
  productId,
  canEdit,
}: {
  productId: number;
  canEdit: boolean;
}) {
  const history = useCostHistory(productId);
  const variants = useVariantCosts(productId);
  const rows = history.data ?? [];
  const scope = (variantId: number | null) =>
    rows.filter((r) => r.variantId === variantId);
  return (
    <div className="grid gap-2 py-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-40 text-[13px]" style={{ color: COLORS.muted }}>
          Product level
        </span>
        <History rows={scope(null)} canEdit={canEdit} />
        {canEdit && <AddCost productId={productId} variantId={null} />}
      </div>
      {(variants.data ?? []).map((v) => (
        <div key={v.id} className="flex flex-wrap items-center gap-3">
          <span className="w-40 text-[13px]" style={{ color: COLORS.muted }}>
            {v.sku ?? `Variant ${v.id}`}
          </span>
          <History rows={scope(v.id)} canEdit={canEdit} />
          {canEdit && <AddCost productId={productId} variantId={v.id} />}
        </div>
      ))}
    </div>
  );
}

export function CostHistoryEditor({ canEdit }: { canEdit: boolean }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const products = useProductCosts(search);
  const items = products.data?.items ?? [];
  return (
    <div>
      <input
        type="search"
        aria-label="Search products"
        placeholder="Search products"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-2.5 min-h-[34px] w-full rounded-[7px] border bg-white px-2 text-sm sm:w-80"
        style={{ borderColor: COLORS.line }}
      />
      <div
        className="divide-y rounded-xl border"
        style={{ borderColor: COLORS.line }}
      >
        {items.map((p) => (
          <div key={p.id} className="px-3 py-2">
            <button
              type="button"
              aria-expanded={open === p.id}
              onClick={() => setOpen(open === p.id ? null : p.id)}
              className="flex w-full items-center justify-between text-left"
            >
              <span>
                {p.name}
                <span
                  className="ml-2 text-[13px]"
                  style={{ color: COLORS.muted }}
                >
                  {p.price ? `sells at ${tk(Number(p.price))}` : ""}
                  {p.variantCount ? `, ${p.variantCount} variants` : ""}
                </span>
              </span>
              <span className="text-sm" style={{ color: COLORS.green }}>
                {open === p.id ? "Hide" : "Costs"}
              </span>
            </button>
            {open === p.id && (
              <ProductCosts productId={p.id} canEdit={canEdit} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
