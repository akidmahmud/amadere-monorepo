"use client";

import { Fragment, useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { Button, Card, Icon, Modal, RangeSlider, RevenueProfitTrend, SettingsCard, Table, TableEmptyRow, ToggleSwitch } from "@amader/admin-ui";
import {
  ReportsStatsStrip,
} from "@/components/net-profit/ReportsStatsStrip";
import {
  ReportsFilterBar,
  resolveRange,
  type RangeKey,
} from "@/components/net-profit/ReportsFilterBar";
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

const GREEN = "#2e7d43";
const GREEN_HEADER = "#2f7d33";
const LINE = "#e5ebe6";
const INK = "#1e2b22";
const MUTED = "#64766b";
const TEXT = "#374840";
const FAINT = "#94a69a";

function HeaderButton({ children, onClick, href, active }: { children: React.ReactNode; onClick?: () => void; href?: string; active?: boolean }) {
  const className =
    "inline-flex h-10 items-center gap-2 rounded-[10px] border px-[15px] text-[0.8rem] font-bold transition-colors duration-150 hover:bg-[#f2f6f3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2e7d43] focus-visible:ring-offset-1";
  const style = active
    ? { borderColor: GREEN, color: "#fff", background: GREEN }
    : { borderColor: LINE, color: TEXT, background: "#fff" };

  if (href) {
    return (
      <Link href={href} className={className} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className} style={style}>
      {children}
    </button>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 border-b pb-2" style={{ borderColor: LINE }}>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: GREEN }} />
        <h2 className="text-[1.05rem] font-extrabold tracking-tight" style={{ color: INK }}>
          {title}
        </h2>
      </div>
      {subtitle && <span className="text-[0.74rem] font-medium" style={{ color: MUTED }}>{subtitle}</span>}
    </div>
  );
}

const TH = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <th
    className="sticky top-0 z-[5] px-3 py-3 text-left text-[0.72rem] font-bold whitespace-nowrap text-white"
    style={{
      background: GREEN_HEADER,
      borderRight: "1px solid rgba(255,255,255,.13)",
      ...style,
    }}
  >
    {children}
  </th>
);

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

  const td = "px-3 py-[11px] text-[0.76rem] font-semibold whitespace-nowrap align-middle border-b";
  const tdStyle = { color: TEXT, borderColor: "#eef3ef", background: "#fff" } as const;

  return (
    <div className="flex flex-col gap-5">
      <ReportsFilterBar
        rangeKey={rangeKey}
        setRangeKey={setRangeKey}
        customFrom={customFrom}
        setCustomFrom={setCustomFrom}
        customTo={customTo}
        setCustomTo={setCustomTo}
        exportParams={exportParams}
      />

      <ReportsStatsStrip
        revenue={Number(report?.revenue ?? 0)}
        cogs={Number(report?.cogs ?? 0)}
        adSpend={Number(report?.adSpend ?? 0)}
        shipping={Number(report?.shipping ?? 0)}
        netProfit={Number(report?.netProfit ?? 0)}
        marginPercent={Number(report?.marginPercent ?? 0)}
      />

      <div>
        <SectionHeader title="Revenue & Profit Trend" />
        <RevenueProfitTrend
          data={(cache ?? []).map((d) => ({
            reportDate: d.reportDate,
            totalRevenue: Number(d.totalRevenue || 0),
            netProfit: Number(d.netProfit || 0),
            totalBuyCost: Number(d.totalBuyCost || 0),
            totalAdsCost: Number(d.totalAdsCost || 0),
          }))}
        />
      </div>

      <div>
        <SectionHeader title="Hourly Sales Performance" subtitle="Sales amount and order count by hour of day" />
        <div className="rounded-card border p-4 shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: LINE }}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {overview?.hourlyPerformance.map((slot) => (
              <div
                key={slot.label}
                className="rounded-[10px] p-4 text-white shadow-sm"
                style={{ background: "linear-gradient(135deg, #1e2b22 0%, #2e7d43 100%)" }}
              >
                <div className="text-[0.72rem] font-semibold text-white/85">{slot.label}</div>
                <div className="mt-1.5 text-[1.15rem] font-extrabold">৳ {Number(slot.revenue).toFixed(2)}</div>
                <div className="my-2.5 h-1.5 overflow-hidden rounded-pill bg-white/20">
                  <div className="h-full rounded-pill bg-white" style={{ width: `${Math.max(slot.barWidth, slot.orders > 0 ? 6 : 2)}%` }} />
                </div>
                <div className="text-[0.7rem] font-medium text-white/80">{slot.orders} orders</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <SectionHeader title="Top Selling Products" />
        <div className="overflow-hidden rounded-card border shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: LINE }}>
          <div className="overflow-auto" style={{ maxHeight: "400px" }}>
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <TH style={{ width: 50 }}>#</TH>
                  <TH>Product</TH>
                  <TH>Sale Price</TH>
                  <TH>Single Profit</TH>
                  <TH>Sold Qty</TH>
                </tr>
              </thead>
              <tbody>
                {topProducts && topProducts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-sm" style={{ color: FAINT }}>
                      No sales data found for this period.
                    </td>
                  </tr>
                )}
                {topProducts?.map((p, i) => (
                  <tr key={p.productId} className="[&:hover>td]:bg-[#f7fbf8]">
                    <td className={td} style={{ ...tdStyle, color: FAINT }}>
                      {i + 1}
                    </td>
                    <td className={td} style={{ ...tdStyle, fontWeight: 700, color: INK }}>
                      <span className="block max-w-[320px] truncate" title={p.name}>
                        {p.name}
                      </span>
                    </td>
                    <td className={td} style={tdStyle}>
                      ৳{(p.quantity > 0 ? Number(p.revenue) / p.quantity : 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className={td} style={tdStyle}>
                      {p.profitPerUnit === null ? (
                        <span style={{ color: FAINT }}>—</span>
                      ) : (
                        <span className={Number(p.profitPerUnit) >= 0 ? "font-bold text-success" : "font-bold text-danger"}>
                          ৳{Number(p.profitPerUnit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </td>
                    <td className={td} style={{ ...tdStyle, fontWeight: 700, color: GREEN }}>
                      {p.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div>
        <SectionHeader title="Daily Profit Log" />
        <div className="overflow-hidden rounded-card border shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: LINE }}>
          <div className="overflow-auto" style={{ maxHeight: "450px" }}>
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <TH>Date</TH>
                  <TH>Revenue</TH>
                  <TH>Buy Cost</TH>
                  <TH>Ads Cost</TH>
                  <TH>Net Profit</TH>
                </tr>
              </thead>
              <tbody>
                {cache && cache.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-sm" style={{ color: FAINT }}>
                      No daily profit log records found.
                    </td>
                  </tr>
                )}
                {[...(cache ?? [])].reverse().map((d) => (
                  <tr key={d.reportDate} className="[&:hover>td]:bg-[#f7fbf8]">
                    <td className={td} style={{ ...tdStyle, fontWeight: 700, color: INK }}>
                      {d.reportDate}
                    </td>
                    <td className={td} style={tdStyle}>
                      ৳{Number(d.totalRevenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className={td} style={tdStyle}>
                      ৳{Number(d.totalBuyCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className={td} style={tdStyle}>
                      ৳{Number(d.totalAdsCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className={td} style={tdStyle}>
                      <span className={Number(d.netProfit) >= 0 ? "font-extrabold text-success" : "font-extrabold text-danger"}>
                        ৳{Number(d.netProfit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

const editIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </svg>
);

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
        className="h-8 w-24 rounded-[8px] border bg-white px-2 text-[0.75rem] font-bold outline-none"
        style={{ borderColor: GREEN }}
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
      <span className="text-[0.76rem] font-semibold text-text">{value === null ? "—" : `৳${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}</span>
      <span className="text-[#2e7d43] opacity-60 group-hover/edit:opacity-100">{editIcon}</span>
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
                  <td className={profit === null ? "text-muted" : profit >= 0 ? "text-success font-bold" : "text-danger font-bold"}>
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
          update.mutate({ price: n }, { onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCT_COST_KEY }) });
        }
      }}
      className="h-8 w-24 rounded-[8px] border bg-white px-2 text-[0.75rem] font-semibold outline-none hover:border-[#2e7d43] focus:border-[#2e7d43]"
      style={{ borderColor: LINE, color: TEXT }}
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
        if (draft === "") return;
        const n = Number(draft);
        if (!Number.isNaN(n) && n !== value) {
          update.mutate({ salePrice: n }, { onSuccess: () => qc.invalidateQueries({ queryKey: PRODUCT_COST_KEY }) });
        }
      }}
      className="h-8 w-24 rounded-[8px] border bg-white px-2 text-[0.75rem] font-semibold outline-none hover:border-[#2e7d43] focus:border-[#2e7d43]"
      style={{ borderColor: LINE, color: TEXT }}
    />
  );
}

function ProductRow({
  product: p,
  index: i,
  costDraft,
  onCostDraftChange,
  onOpenVariants,
  td,
  tdStyle,
}: {
  product: ProductCostRow;
  index: number;
  costDraft: string | undefined;
  onCostDraftChange: (v: string) => void;
  onOpenVariants: () => void;
  td: string;
  tdStyle: { color: string; borderColor: string; background: string };
}) {
  const salePrice = Number(p.salePrice ?? p.price ?? 0);
  const cost = costDraft !== undefined ? Number(costDraft) : p.costPerItem !== null ? Number(p.costPerItem) : null;
  const singleProfit = p.variantCount > 0 || cost === null ? null : salePrice - cost;

  return (
    <tr className="[&:hover>td]:bg-[#f7fbf8]">
      <td className={td} style={{ ...tdStyle, color: FAINT }}>
        {i + 1}
      </td>
      <td className={td} style={tdStyle}>
        <div className="flex items-center gap-2.5">
          {p.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.thumbnailUrl} alt="" className="h-8 w-8 shrink-0 rounded-inner border border-border object-cover" />
          ) : (
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-inner bg-surface-2 text-[10px] text-muted">—</span>
          )}
          <span className="min-w-0 max-w-[280px] truncate text-text font-semibold">{p.name}</span>
          {p.variantCount > 0 && (
            <span className="shrink-0 rounded-pill bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-400">
              Variable ({p.variantCount})
            </span>
          )}
        </div>
      </td>
      <td className={td} style={tdStyle}>
        <PriceCell productId={p.id} value={Number(p.price ?? 0)} />
      </td>
      <td className={td} style={tdStyle}>
        <SalePriceCell productId={p.id} value={p.salePrice === null ? null : Number(p.salePrice)} />
      </td>
      <td className={td} style={tdStyle}>
        {p.variantCount > 0 ? (
          <button
            type="button"
            onClick={onOpenVariants}
            className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-2.5 text-[0.7rem] font-bold"
            style={{ borderColor: LINE, color: TEXT }}
          >
            Variations
          </button>
        ) : (
          <input
            type="number"
            min={0}
            value={costDraft ?? p.costPerItem ?? "0"}
            onChange={(e) => onCostDraftChange(e.target.value)}
            className="h-8 w-24 rounded-[8px] border bg-white px-2 text-[0.75rem] font-semibold outline-none hover:border-[#2e7d43] focus:border-[#2e7d43]"
            style={{ borderColor: LINE, color: TEXT }}
          />
        )}
      </td>
      <td className={td} style={tdStyle}>
        {singleProfit === null ? (
          <span style={{ color: FAINT }}>—</span>
        ) : (
          <span className={singleProfit >= 0 ? "font-bold text-success" : "font-bold text-danger"}>
            ৳{singleProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        )}
      </td>
    </tr>
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
  const td = "px-3 py-[11px] text-[0.76rem] font-semibold whitespace-nowrap align-middle border-b";
  const tdStyle = { color: TEXT, borderColor: "#eef3ef", background: "#fff" } as const;

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader title="Quick Owner Buy Price Editor" />
      <div className="flex flex-wrap items-center gap-3 rounded-card border p-[14px_16px] shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: LINE }}>
        <div className="relative w-[260px]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products by title..."
            className="h-[38px] w-full rounded-[9px] border py-0 pr-[34px] pl-3 text-[0.76rem] outline-none"
            style={{ borderColor: LINE, color: "#374840" }}
          />
          <svg className="pointer-events-none absolute top-1/2 right-[11px] -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={FAINT} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </div>
        <button
          type="button"
          disabled={bulkSet.isPending || dirtyRows.length === 0}
          onClick={() =>
            bulkSet.mutate(
              dirtyRows.map(([productId, v]) => ({ productId: Number(productId), costPerItem: Number(v) })),
              { onSuccess: () => setDrafts({}) },
            )
          }
          className="ml-auto inline-flex h-[38px] items-center gap-2 rounded-[9px] px-4 text-[0.78rem] font-bold text-white shadow-sm disabled:opacity-40"
          style={{ background: GREEN }}
        >
          {bulkSet.isPending ? "Saving…" : `Save All ${dirtyRows.length > 0 ? `(${dirtyRows.length})` : ""}`}
        </button>
      </div>

      <div className="overflow-hidden rounded-card border shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: LINE }}>
        <div className="overflow-auto" style={{ maxHeight: "62vh" }}>
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <TH style={{ width: 50 }}>#</TH>
                <TH>Product</TH>
                <TH>Regular Price</TH>
                <TH>Sale Price</TH>
                <TH>Owner Buy Price</TH>
                <TH>Single Profit</TH>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm" style={{ color: FAINT }}>
                    Loading product buy prices…
                  </td>
                </tr>
              )}
              {!isLoading && data && data.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm" style={{ color: FAINT }}>
                    No products found matching your search.
                  </td>
                </tr>
              )}
              {!isLoading &&
                data?.items.map((p, i) => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    index={i}
                    costDraft={drafts[p.id]}
                    onCostDraftChange={(v) => setDrafts({ ...drafts, [p.id]: v })}
                    onOpenVariants={() => setExpanded(p.id)}
                    td={td}
                    tdStyle={tdStyle}
                  />
                ))}
            </tbody>
          </table>
        </div>
      </div>

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
    <SettingsCard icon={<Icon name="attach_money" />} title="Fallback Profit">
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
      <SettingsCard icon={<Icon name="campaign" />} title={`Today's Marketing Cost (${today})`}>
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

      <SettingsCard icon={<Icon name="grid_view" />} title="Report Configuration">
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

      <SettingsCard icon={<Icon name="mail" />} title="Auto Report Delivery">
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
  const [section, setSection] = useState<"dashboard" | "products" | "settings">("dashboard");

  return (
    <div className="flex flex-col gap-[18px]">
      {/* Top Header matching Order Manager */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.45rem] font-extrabold tracking-tight" style={{ color: INK }}>
            Reports & Profit Analytics
          </h1>
          <div className="mt-1.5 flex items-center gap-1.5 text-[0.76rem] font-semibold" style={{ color: MUTED }}>
            Dashboard <span style={{ color: "#94a69a" }}>›</span> Net Profit <span style={{ color: "#94a69a" }}>›</span>{" "}
            <span style={{ color: GREEN }}>Reports</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <HeaderButton active={section === "dashboard"} onClick={() => setSection("dashboard")}>
            Dashboard
          </HeaderButton>
          <HeaderButton active={section === "products"} onClick={() => setSection("products")}>
            Products
          </HeaderButton>
          <HeaderButton active={section === "settings"} onClick={() => setSection("settings")}>
            Settings
          </HeaderButton>
        </div>
      </div>

      {section === "dashboard" && <DashboardTab />}
      {section === "products" && <ProductsTab />}
      {section === "settings" && <SettingsTab />}
    </div>
  );
}
