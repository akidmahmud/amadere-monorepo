"use client";

import { Fragment, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { BarChart, Button, Card, Icon, Modal, PageHeader, RangeSlider, SettingsCard, StatCard, Table, TableEmptyRow, Tabs, ToggleSwitch } from "@amader/admin-ui";
import {
  useBulkSetProductCost,
  useFallbackProfitSettings,
  useProductCosts,
  useProfitReport,
  useSetVariantCost,
  useUpdateFallbackProfitSettings,
  useUpdateVariantPrice,
  useVariantCosts,
  PRODUCT_COST_KEY,
  type FallbackProfitSettings,
  type ProductCostRow,
} from "@/hooks/useProfit";
import { useUpdateProduct } from "@/hooks/useProducts";
import { useQueryClient } from "@tanstack/react-query";
import {
  useDailyProfitCache,
  useMarketingCostSettings,
  useMarketingCosts,
  useSetMarketingCost,
  useUpdateMarketingCostSettings,
} from "@/hooks/useMarketingCost";
import { useFraudSettings, useUpdateFraudSettings } from "@/hooks/useFraud";
import { useHourlySlot, useNetProfitOverviewRange, useSetHourlySlot } from "@/hooks/useNetProfitOverview";
import { useTopProducts } from "@/hooks/useSalesReport";

const reportIcon = <Icon name="bar_chart" />;
const dollarIcon = <Icon name="attach_money" />;
const barIcon = <Icon name="bar_chart" />;
const clockIcon = <Icon name="schedule" />;
const starIcon = <Icon name="star" fill />;
const calendarIcon = <Icon name="calendar_month" />;
const bagIcon = <Icon name="shopping_bag" />;
const gridIcon = <Icon name="grid_view" />;
const mailIcon = <Icon name="mail" />;
const megaphoneIcon = <Icon name="campaign" />;
const filterIcon = <Icon name="filter_alt" fill />;

function SectionHeader({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 border-b border-border pb-2.5">
      <div className="flex items-center gap-2">
        <span className="text-brand-500 [&>svg]:h-[18px] [&>svg]:w-[18px]">{icon}</span>
        <h2 className="font-ui text-[15px] font-bold text-text">{title}</h2>
      </div>
      {subtitle && <span className="text-xs italic text-muted">{subtitle}</span>}
    </div>
  );
}

type RangeKey = "today" | "yesterday" | "7d" | "month" | "year" | "all" | "custom";
const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 Days" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
  { value: "all", label: "All Time" },
];

// Calendar month/year-to-date, not a rolling window — matches the plugin's
// own get_date_range() semantics rather than a generic "last N days".
function resolveRange(key: RangeKey, customFrom: string, customTo: string): { from: Date; to: Date } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  switch (key) {
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case "7d": {
      const from = new Date(now);
      from.setDate(from.getDate() - 6);
      return { from: startOfDay(from), to: endOfDay(now) };
    }
    case "month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) };
    case "year":
      return { from: new Date(now.getFullYear(), 0, 1), to: endOfDay(now) };
    case "all":
      return { from: new Date(2000, 0, 1), to: endOfDay(now) };
    case "custom":
      return {
        from: customFrom ? startOfDay(new Date(customFrom)) : startOfDay(now),
        to: customTo ? endOfDay(new Date(customTo)) : endOfDay(now),
      };
    default:
      return { from: startOfDay(now), to: endOfDay(now) };
  }
}

function FilterBar({
  rangeKey,
  setRangeKey,
  customFrom,
  setCustomFrom,
  customTo,
  setCustomTo,
  exportParams,
}: {
  rangeKey: RangeKey;
  setRangeKey: (r: RangeKey) => void;
  customFrom: string;
  setCustomFrom: (v: string) => void;
  customTo: string;
  setCustomTo: (v: string) => void;
  exportParams: URLSearchParams;
}) {
  const [showCustom, setShowCustom] = useState(false);
  const activeLabel = rangeKey === "custom" ? "Custom" : RANGE_OPTIONS.find((r) => r.value === rangeKey)?.label;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-brand-500 [&>svg]:h-4 [&>svg]:w-4">{filterIcon}</span>
          <span className="font-ui text-sm font-bold text-text">Filter</span>
          <span className="rounded-pill bg-brand-500 px-3 py-1 text-xs font-semibold text-white">{activeLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <a href={`/api/backend/admin/net-profit/reports/sales/export?${exportParams.toString()}`} download>
            <Button type="button" variant="ghost"><Icon name="description" size={16} /> CSV</Button>
          </a>
          <a href={`/api/backend/admin/net-profit/reports/sales/export.html?${exportParams.toString()}`} download>
            <Button type="button" variant="ghost"><Icon name="code" size={16} /> HTML</Button>
          </a>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {RANGE_OPTIONS.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => {
              setRangeKey(r.value);
              setShowCustom(false);
            }}
            className={`rounded-pill px-3 py-1.5 text-xs font-semibold ${
              rangeKey === r.value ? "bg-brand-500 text-white" : "bg-surface-2 text-secondary"
            }`}
          >
            {r.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setRangeKey("custom");
            setShowCustom((v) => !v);
          }}
          className={`ml-auto inline-flex items-center gap-1 rounded-pill px-3 py-1.5 text-xs font-semibold ${
            rangeKey === "custom" ? "bg-brand-500 text-white" : "bg-surface-2 text-secondary"
          }`}
        >
          <Icon name="calendar_month" size={16} /> Custom
        </button>
      </div>
      {showCustom && (
        <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-border pt-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">From</span>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">To</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
          </label>
        </div>
      )}
    </Card>
  );
}

function DashboardTab() {
  const [rangeKey, setRangeKey] = useState<RangeKey>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const { from, to } = resolveRange(rangeKey, customFrom, customTo);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const { data: report } = useProfitReport(fromIso, toIso);
  const { data: cache } = useDailyProfitCache(fromIso.slice(0, 10), toIso.slice(0, 10));
  const { data: overview } = useNetProfitOverviewRange(fromIso, toIso);
  const { data: topProducts } = useTopProducts(fromIso, toIso);

  const chartData = (cache ?? []).slice(-14).map((d) => ({
    label: d.reportDate.slice(5),
    current: Number(d.totalRevenue),
    compare: Number(d.netProfit),
  }));

  const exportParams = new URLSearchParams({ groupBy: "day", from: fromIso, to: toIso });

  return (
    <div className="flex flex-col gap-5">
      <FilterBar
        rangeKey={rangeKey}
        setRangeKey={setRangeKey}
        customFrom={customFrom}
        setCustomFrom={setCustomFrom}
        customTo={customTo}
        setCustomTo={setCustomTo}
        exportParams={exportParams}
      />

      <div>
        <SectionHeader icon={dollarIcon} title="Profit Summary" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatCard variant="success" label="Total Revenue" value={`৳${Number(report?.revenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
          <StatCard variant="danger" label="Buy Cost" value={`৳${Number(report?.cogs ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
          <StatCard variant="warning" label="Ads Cost" value={`৳${Number(report?.adSpend ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
          <StatCard variant="recovery" label="Shipping" value={`৳${Number(report?.shipping ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
          <StatCard variant="primary" label="Net Profit" value={`৳${Number(report?.netProfit ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}>
            <span className="mt-2 inline-block rounded-pill bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">{report?.marginPercent ?? 0}%</span>
          </StatCard>
        </div>
      </div>

      <div>
        <SectionHeader icon={barIcon} title="Revenue & Profit Trend" />
        <BarChart title="" currentLabel="Revenue" compareLabel="Profit" data={chartData.length > 0 ? chartData : [{ label: "—", current: 0, compare: 0 }]} />
      </div>

      <div>
        <SectionHeader icon={clockIcon} title="Hourly Sales Performance" subtitle="Sales amount and order count by hour of day." />
        <Card>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {overview?.hourlyPerformance.map((slot) => (
              <div
                key={slot.label}
                className="rounded-inner p-4 text-white"
                style={{ background: "linear-gradient(135deg, var(--wpfok-black, #0b0412) 0%, #3d1a66 55%, var(--brand-500) 100%)" }}
              >
                <div className="text-xs font-semibold text-white/85">{slot.label}</div>
                <div className="num mt-1.5 text-lg font-bold">৳ {Number(slot.revenue).toFixed(2)}</div>
                <div className="my-2.5 h-1 overflow-hidden rounded-pill bg-white/20">
                  <div className="h-full rounded-pill bg-white" style={{ width: `${Math.max(slot.barWidth, slot.orders > 0 ? 6 : 2)}%` }} />
                </div>
                <div className="text-xs text-white/75">{slot.orders} orders</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div>
        <SectionHeader icon={starIcon} title="Top Selling Products" />
        <Card className="overflow-hidden p-0">
          <Table>
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>Sale Price</th>
                <th>Single Profit</th>
                <th>Sold</th>
              </tr>
            </thead>
            <tbody>
              {topProducts && topProducts.length === 0 && <TableEmptyRow colSpan={5}>No data found.</TableEmptyRow>}
              {topProducts?.map((p, i) => (
                <tr key={p.productId}>
                  <td className="text-secondary">{i + 1}</td>
                  <td className="min-w-0 max-w-[280px] truncate text-text">{p.name}</td>
                  <td className="num text-text">৳{(p.quantity > 0 ? Number(p.revenue) / p.quantity : 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className={p.profitPerUnit === null ? "text-muted" : Number(p.profitPerUnit) >= 0 ? "text-success" : "text-danger"}>
                    {p.profitPerUnit === null ? "—" : `৳${Number(p.profitPerUnit).toLocaleString()}`}
                  </td>
                  <td className="num text-secondary">{p.quantity}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>

      <div>
        <SectionHeader icon={calendarIcon} title="Daily Profit Log" />
        <Card className="overflow-hidden p-0">
          <Table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Revenue</th>
                <th>Buy Cost</th>
                <th>Ads Cost</th>
                <th>Profit</th>
              </tr>
            </thead>
            <tbody>
              {cache && cache.length === 0 && <TableEmptyRow colSpan={5}>No daily profit computed yet.</TableEmptyRow>}
              {[...(cache ?? [])].reverse().map((d) => (
                <tr key={d.reportDate}>
                  <td className="num text-text">{d.reportDate}</td>
                  <td className="text-secondary">৳{Number(d.totalRevenue).toLocaleString()}</td>
                  <td className="text-secondary">৳{Number(d.totalBuyCost).toLocaleString()}</td>
                  <td className="text-secondary">৳{Number(d.totalAdsCost).toLocaleString()}</td>
                  <td className={`font-semibold ${Number(d.netProfit) >= 0 ? "text-success" : "text-danger"}`}>৳{Number(d.netProfit).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}

const editIcon = <Icon name="edit" size={13} />;

// Click the pencil (or the value) to edit in place; blur/Enter saves,
// Escape cancels. Shared by all three editable columns in the Variations
// modal — they differ only in what onSave does with the number.
function EditableAmount({ value, onSave }: { value: string | null; onSave: (n: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        min={0}
        step="0.01"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = Number(draft);
          if (draft !== "" && !Number.isNaN(n) && n !== Number(value ?? 0)) onSave(n);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setEditing(false);
        }}
        className="num h-8 w-24 rounded-sm border border-brand-500 bg-surface px-2 text-sm text-text outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value ?? "");
        setEditing(true);
      }}
      className="group/edit flex items-center gap-1.5"
    >
      <span className="num font-semibold text-text">{value === null ? "—" : `৳${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}</span>
      <span className="text-brand-500 opacity-60 group-hover/edit:opacity-100">{editIcon}</span>
    </button>
  );
}

function VariantsModal({ productId, productName, onClose }: { productId: number; productName: string; onClose: () => void }) {
  const { data, isLoading } = useVariantCosts(productId);
  const setVariantCost = useSetVariantCost();
  const updatePrice = useUpdateVariantPrice(productId);

  return (
    <Modal open onClose={onClose} title={`${productName} — Variations`} className="max-w-3xl">
      {isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : data && data.length === 0 ? (
        <p className="text-sm text-muted">This product has no variants.</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Variation</th>
              <th>Regular Price</th>
              <th>Sale Price</th>
              <th>Buy Price</th>
              <th>Profit</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((v) => {
              const sale = v.salePrice !== null ? Number(v.salePrice) : Number(v.price);
              const cost = v.costPerItem !== null ? Number(v.costPerItem) : null;
              const profit = cost === null ? null : sale - cost;
              return (
                <tr key={v.id}>
                  <td className="font-semibold text-text">
                    <div className="flex items-center gap-2">
                      {v.swatchImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={v.swatchImageUrl} alt="" className="h-6 w-6 shrink-0 rounded-inner border border-border object-cover" />
                      ) : v.swatchColorHex ? (
                        <span className="h-6 w-6 shrink-0 rounded-inner border border-border" style={{ background: v.swatchColorHex }} />
                      ) : null}
                      {v.sku ?? `Variant #${v.id}`}
                    </div>
                  </td>
                  <td><EditableAmount value={v.price} onSave={(n) => updatePrice.mutate({ variantId: v.id, price: n })} /></td>
                  <td><EditableAmount value={v.salePrice} onSave={(n) => updatePrice.mutate({ variantId: v.id, salePrice: n })} /></td>
                  <td>
                    <EditableAmount
                      value={v.costPerItem}
                      onSave={(n) => setVariantCost.mutate({ variantId: v.id, buyPrice: n })}
                    />
                  </td>
                  <td className={profit === null ? "text-muted" : profit >= 0 ? "text-success" : "text-danger"}>
                    {profit === null ? "—" : `৳${profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </Modal>
  );
}

// Regular/Sale price edit here saves straight through the same product-edit
// endpoint the Catalog page uses (`PATCH /admin/products/:id`) — this table
// doesn't own pricing, it's just another place to edit it quickly.
function PriceCell({ productId, value }: { productId: number; value: number }) {
  const [draft, setDraft] = useState(String(value));
  const update = useUpdateProduct(productId);
  const qc = useQueryClient();

  useEffect(() => setDraft(String(value)), [value]);

  return (
    <input
      type="number"
      min={0}
      step="0.01"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const n = Number(draft);
        if (draft !== "" && !Number.isNaN(n) && n !== value) {
          // useUpdateProduct only invalidates the Catalog page's own cache
          // (admin-products) — this table reads from the net-profit
          // product-cost endpoint instead, so Single Profit needs its own
          // invalidation or it'd keep showing stale price/salePrice.
          update.mutate({ price: n }, { onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCT_COST_KEY }) });
        }
      }}
      className="num h-9 w-24 rounded-sm border border-border bg-surface px-2 text-sm text-text outline-none focus:border-brand-500"
    />
  );
}

function SalePriceCell({ productId, value }: { productId: number; value: number | null }) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  const update = useUpdateProduct(productId);
  const qc = useQueryClient();

  useEffect(() => setDraft(value === null ? "" : String(value)), [value]);

  return (
    <input
      type="number"
      min={0}
      step="0.01"
      placeholder="—"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        // The backend's UpdateProductDto validates salePrice as a plain
        // number (no null) — clearing a sale back to "no sale" isn't
        // something this quick editor can express, only setting a new one.
        if (draft === "") return;
        const n = Number(draft);
        if (!Number.isNaN(n) && n !== value) {
          update.mutate({ salePrice: n }, { onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCT_COST_KEY }) });
        }
      }}
      className="num h-9 w-24 rounded-sm border border-border bg-surface px-2 text-sm text-text outline-none focus:border-brand-500"
    />
  );
}

function ProductRow({
  product: p,
  index: i,
  costDraft,
  onCostDraftChange,
  onOpenVariants,
}: {
  product: ProductCostRow;
  index: number;
  costDraft: string | undefined;
  onCostDraftChange: (v: string) => void;
  onOpenVariants: () => void;
}) {
  const salePrice = Number(p.salePrice ?? p.price ?? 0);
  const cost = costDraft !== undefined ? Number(costDraft) : p.costPerItem !== null ? Number(p.costPerItem) : null;
  const singleProfit = p.variantCount > 0 || cost === null ? null : salePrice - cost;

  return (
    <Fragment>
      <tr>
        <td className="text-secondary">{i + 1}</td>
        <td className="min-w-0 max-w-[300px]">
          <div className="flex items-center gap-2.5">
            {p.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.thumbnailUrl} alt="" className="h-9 w-9 shrink-0 rounded-inner border border-border object-cover" />
            ) : (
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-inner bg-surface-2 text-[10px] text-muted">—</span>
            )}
            <span className="min-w-0 truncate text-text">{p.name}</span>
            {p.variantCount > 0 && (
              <span className="shrink-0 rounded-pill bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-500">
                Variable ({p.variantCount})
              </span>
            )}
          </div>
        </td>
        <td><PriceCell productId={p.id} value={Number(p.price ?? 0)} /></td>
        <td><SalePriceCell productId={p.id} value={p.salePrice === null ? null : Number(p.salePrice)} /></td>
        <td>
          {p.variantCount > 0 ? (
            <Button type="button" variant="ghost" onClick={onOpenVariants}>
              <Icon name="tune" size={16} /> Variations
            </Button>
          ) : (
            <input
              type="number"
              min={0}
              value={costDraft ?? p.costPerItem ?? "0"}
              onChange={(e) => onCostDraftChange(e.target.value)}
              className="num h-9 w-24 rounded-sm border border-border bg-surface px-2 text-sm text-text outline-none focus:border-brand-500"
            />
          )}
        </td>
        <td className={singleProfit === null ? "text-muted" : singleProfit >= 0 ? "text-success" : "text-danger"}>
          {singleProfit === null ? "—" : `৳${singleProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
        </td>
      </tr>
    </Fragment>
  );
}

function ProductsTab() {
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useProductCosts(searchDebounced || undefined);
  const bulkSet = useBulkSetProductCost();
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [expanded, setExpanded] = useState<number | null>(null);

  const dirtyRows = Object.entries(drafts).filter(([, v]) => v !== "");

  return (
    <div>
      <SectionHeader icon={bagIcon} title="Quick Owner Buy Price Editor" />
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="h-10 w-64 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
          <Button
            type="button"
            variant="primary"
            className="ml-auto"
            disabled={bulkSet.isPending || dirtyRows.length === 0}
            onClick={() =>
              bulkSet.mutate(
                dirtyRows.map(([productId, v]) => ({ productId: Number(productId), costPerItem: Number(v) })),
                { onSuccess: () => setDrafts({}) },
              )
            }
          >
            {bulkSet.isPending ? (
              "Saving…"
            ) : (
              <>
                <Icon name="check" size={16} /> Save All{dirtyRows.length > 0 ? ` (${dirtyRows.length})` : ""}
              </>
            )}
          </Button>
        </div>

        {isLoading && <p className="p-4 text-sm text-muted">Loading…</p>}

        <Table>
          <thead>
            <tr>
              <th>#</th>
              <th>Product</th>
              <th>Regular Price</th>
              <th>Sale Price</th>
              <th>Owner Buy Price</th>
              <th>Single Profit</th>
            </tr>
          </thead>
          <tbody>
            {data && data.items.length === 0 && <TableEmptyRow colSpan={6}>No products found.</TableEmptyRow>}
            {data?.items.map((p, i) => (
              <ProductRow
                key={p.id}
                product={p}
                index={i}
                costDraft={drafts[p.id]}
                onCostDraftChange={(v) => setDrafts({ ...drafts, [p.id]: v })}
                onOpenVariants={() => setExpanded(p.id)}
              />
            ))}
          </tbody>
        </Table>
      </Card>

      {expanded !== null && (
        <VariantsModal
          productId={expanded}
          productName={data?.items.find((p) => p.id === expanded)?.name ?? ""}
          onClose={() => setExpanded(null)}
        />
      )}
    </div>
  );
}

function FallbackProfitCard() {
  const { data, isLoading } = useFallbackProfitSettings();
  const update = useUpdateFallbackProfitSettings();
  const [form, setForm] = useState<FallbackProfitSettings | null>(null);
  const current = form ?? data;

  return (
    <SettingsCard icon={dollarIcon} title="Fallback Profit">
      {isLoading || !current ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <ToggleSwitch
            checked={current.enabled}
            onChange={(v) => setForm({ ...current, enabled: v })}
            label="Enable Fallback Profit"
          />
          <p className="-mt-2 text-xs text-muted">When enabled, if a product has no Owner Buy Price set, this fallback will be used to estimate profit instead.</p>
          {current.enabled && (
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">Fallback Type</span>
                <select
                  value={current.type}
                  onChange={(e) => setForm({ ...current, type: e.target.value as "percentage" | "fixed" })}
                  className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                >
                  <option value="percentage">Percentage of Sale Price</option>
                  <option value="fixed">Fixed profit per unit (৳)</option>
                </select>
                <span className="text-xs text-muted">Percentage: e.g. 20% of ৳1000 = ৳200 profit. Fixed: flat amount per unit.</span>
              </label>
              {current.type === "percentage" ? (
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-secondary">Fallback Value</span>
                  <RangeSlider value={current.value} onChange={(v) => setForm({ ...current, value: v })} suffix="%" />
                </label>
              ) : (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-secondary">Fallback Value (৳)</span>
                  <input
                    type="number"
                    min={0}
                    value={current.value}
                    onChange={(e) => setForm({ ...current, value: Number(e.target.value) })}
                    className="h-10 w-40 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                  />
                </label>
              )}
            </div>
          )}
          <Button type="button" variant="primary" className="self-start" disabled={update.isPending} onClick={() => update.mutate(current, { onSuccess: () => setForm(null) })}>
            {update.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      )}
    </SettingsCard>
  );
}

const SLOT_OPTIONS = [1, 2, 3, 4, 6, 12];

function SettingsTab() {
  const { data: costs } = useMarketingCosts();
  const setCost = useSetMarketingCost();
  const today = new Date().toISOString().slice(0, 10);
  const todayCost = costs?.find((c) => c.costDate === today);
  const [adsCost, setAdsCost] = useState("");
  const [otherCost, setOtherCost] = useState("");
  const [note, setNote] = useState("");

  const { data: mcSettings } = useMarketingCostSettings();
  const updateMcSettings = useUpdateMarketingCostSettings();
  const [autoCarry, setAutoCarry] = useState<boolean | null>(null);
  const [defaultCost, setDefaultCost] = useState<string | null>(null);

  const { data: hourlySlot } = useHourlySlot();
  const setHourlySlot = useSetHourlySlot();

  const { data: fraudSettings } = useFraudSettings();
  const updateFraudSettings = useUpdateFraudSettings();
  const [deliveryFallback, setDeliveryFallback] = useState<string | null>(null);

  const [autoReport, setAutoReport] = useState<boolean | null>(null);
  const [reportEmail, setReportEmail] = useState<string | null>(null);

  const reportConfigDirty = autoCarry !== null || defaultCost !== null || deliveryFallback !== null;
  const reportConfigSaving = updateMcSettings.isPending || updateFraudSettings.isPending || setHourlySlot.isPending;

  function saveReportConfig() {
    if (autoCarry !== null || defaultCost !== null) {
      updateMcSettings.mutate(
        { ...(autoCarry !== null ? { autoCarryEnabled: autoCarry } : {}), ...(defaultCost !== null ? { defaultMarketingCost: Number(defaultCost) } : {}) },
        { onSuccess: () => { setAutoCarry(null); setDefaultCost(null); } },
      );
    }
    if (deliveryFallback !== null) {
      updateFraudSettings.mutate({ deliveryFallback: Number(deliveryFallback) }, { onSuccess: () => setDeliveryFallback(null) });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SettingsCard icon={megaphoneIcon} title={`Today's Marketing Cost (${today})`}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Ads Cost (৳)</span>
            <input type="number" min={0} placeholder={todayCost?.adsCost ?? "0"} value={adsCost} onChange={(e) => setAdsCost(e.target.value)} className="h-10 w-32 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Other Cost (৳)</span>
            <input type="number" min={0} placeholder={todayCost?.otherCost ?? "0"} value={otherCost} onChange={(e) => setOtherCost(e.target.value)} className="h-10 w-32 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Note</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. FB Ads + Google Ads" className="h-10 w-full rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
          </label>
          <Button
            type="button"
            variant="primary"
            disabled={setCost.isPending || (adsCost === "" && otherCost === "")}
            onClick={() =>
              setCost.mutate(
                { date: today, adsCost: Number(adsCost || todayCost?.adsCost || 0), otherCost: Number(otherCost || todayCost?.otherCost || 0), note: note || undefined },
                { onSuccess: () => { setAdsCost(""); setOtherCost(""); setNote(""); } },
              )
            }
          >
            {setCost.isPending ? "Saving…" : (<><Icon name="check" size={16} /> Save Today</>)}
          </Button>
        </div>
        {todayCost?.autoCarried && <p className="mt-2 text-xs text-warning">Auto-carried forward from the previous day.</p>}
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
          <span className="text-brand-500">ⓘ</span> Auto-carry is {mcSettings?.autoCarryEnabled ? "ON" : "OFF"}.
        </p>
      </SettingsCard>

      <SettingsCard icon={gridIcon} title="Report Configuration">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div className="rounded-inner bg-surface-2 p-3">
              <ToggleSwitch
                checked={autoCarry ?? mcSettings?.autoCarryEnabled ?? false}
                onChange={setAutoCarry}
                label="Auto-carry marketing cost to next day"
              />
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Fraud Delivery Fallback (৳)</span>
              <input
                type="number"
                min={0}
                value={deliveryFallback ?? fraudSettings?.deliveryFallback ?? 0}
                onChange={(e) => setDeliveryFallback(e.target.value)}
                className="h-10 w-40 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
              />
              <span className="text-xs text-muted">Default delivery charge for Fraud Amount Saved.</span>
            </label>
          </div>
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Default Marketing Cost (৳)</span>
              <input
                type="number"
                min={0}
                value={defaultCost ?? mcSettings?.defaultMarketingCost ?? 0}
                onChange={(e) => setDefaultCost(e.target.value)}
                className="h-10 w-40 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Performance Time Slots</span>
              <select
                value={hourlySlot?.hourlySlotHours ?? 2}
                onChange={(e) => setHourlySlot.mutate(Number(e.target.value))}
                disabled={setHourlySlot.isPending}
                className="h-10 w-40 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
              >
                {SLOT_OPTIONS.map((h) => (
                  <option key={h} value={h}>{h}-hour slots</option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <Button type="button" variant="primary" className="mt-4" disabled={!reportConfigDirty || reportConfigSaving} onClick={saveReportConfig}>
          {reportConfigSaving ? "Saving…" : "Save Settings"}
        </Button>
      </SettingsCard>

      <FallbackProfitCard />

      <SettingsCard icon={mailIcon} title="Auto Report Delivery">
        <div className="flex flex-col gap-4">
          <div className="rounded-inner bg-surface-2 p-3">
            <ToggleSwitch
              checked={autoReport ?? mcSettings?.autoReportEnabled ?? false}
              onChange={setAutoReport}
              label="Enable Daily Auto Report"
            />
          </div>
          <p className="-mt-2 text-xs text-muted">When enabled, a daily sales report (CSV) will be emailed to the specified address every day at midnight.</p>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Report Email Address</span>
            <input
              value={reportEmail ?? mcSettings?.reportEmail ?? ""}
              onChange={(e) => setReportEmail(e.target.value)}
              placeholder="admin@example.com"
              className="h-10 w-full max-w-md rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            />
            <span className="text-xs text-muted">Leave blank to skip sending even when enabled. The report covers yesterday&apos;s completed orders.</span>
          </label>
          <Button
            type="button"
            variant="ghost"
            className="self-start"
            disabled={(autoReport === null && reportEmail === null) || updateMcSettings.isPending}
            onClick={() =>
              updateMcSettings.mutate(
                { ...(autoReport !== null ? { autoReportEnabled: autoReport } : {}), ...(reportEmail !== null ? { reportEmail } : {}) },
                { onSuccess: () => { setAutoReport(null); setReportEmail(null); } },
              )
            }
          >
            {updateMcSettings.isPending ? "Saving…" : "Save Settings"}
          </Button>
        </div>
      </SettingsCard>
    </div>
  );
}

export default function SalesReportPage() {
  const [tab, setTab] = useState("dashboard");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader icon={reportIcon} title="Sales Report" subtitle="Net profit analysis, top products, and sales performance insights." />
      <Tabs
        variant="pill"
        options={[
          { value: "dashboard", label: "Dashboard" },
          { value: "products", label: "Products" },
          { value: "settings", label: "Settings" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "dashboard" && <DashboardTab />}
      {tab === "products" && <ProductsTab />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}
