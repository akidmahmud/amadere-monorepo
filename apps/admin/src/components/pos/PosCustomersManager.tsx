"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@amader/admin-ui";
import { proxyFetch } from "@/lib/api/proxy-client";
import { taka } from "@/lib/pos-cart";
import { useToast } from "@/components/ToastProvider";
import { exportAllPagesXlsx } from "@/lib/pos-export";
import { reportTitle } from "@/lib/reportTitle";
import {
  NO_PERIOD,
  PeriodFilter,
  periodParams,
  type Period,
} from "./PeriodFilter";
import { PosTiersTab, TierBadge, usePosTiers } from "./PosTiersTab";
import { PosSmsCampaignsTab } from "./PosSmsCampaignsTab";
import { CustomerHistoryDialog } from "./CustomerHistoryDialog";
import { daysAgo } from "@/lib/pos-days";

type Row = {
  id: number;
  name: string;
  phone: string | null;
  purchases: number;
  spent: string;
  lastPurchase: string;
  stores: string[];
  tiers: {
    store: string;
    key: string | null;
    name: string | null;
    color: string | null;
  }[];
};
type Page = { items: Row[]; total: number };
const PAGE_SIZE = 25;
const fieldBox =
  "flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm";

/**
 * POS Customer Manager. `storeId` fixed = one shop's customers (the POS's
 * own page); `stores` given = every store with a filter (admin panel).
 * `ordersHref` builds the link to that customer's orders.
 */
function CustomersList({
  storeId: fixedStore,
  storeName: fixedStoreName,
  stores,
  ordersHref,
}: {
  storeId?: number;
  /** Name of the fixed store (export title). */
  storeName?: string;
  stores?: { id: number; name: string }[];
  ordersHref: (phone: string) => string;
}) {
  const { data: tierList = [] } = usePosTiers();
  const [tier, setTier] = useState("");
  const [storeFilter, setStoreFilter] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState<Period>(NO_PERIOD);
  const [exporting, setExporting] = useState(false);
  const [history, setHistory] = useState<Row | null>(null);
  const [now] = useState(() => Date.now());
  const toast = useToast();
  const storeId = fixedStore ?? storeFilter;
  const filters = {
    storeId,
    tier,
    q: q.trim(),
    ...periodParams(period),
  };
  const params = new URLSearchParams(
    Object.entries({ ...filters, page, pageSize: PAGE_SIZE }).flatMap(
      ([k, v]) =>
        v === null || v === undefined || v === "" ? [] : [[k, String(v)]],
    ),
  ).toString();
  const exportExcel = async () => {
    setExporting(true);
    try {
      const storeName =
        fixedStoreName ??
        stores?.find((x) => x.id === storeFilter)?.name ??
        "All stores";
      const n = await exportAllPagesXlsx<Row>(
        "/admin/pos/customers/summary",
        filters,
        [
          "Customer",
          "Phone",
          "Purchases",
          "Total spent (৳)",
          "Last purchase",
          "Stores",
        ],
        (c) => [
          c.name,
          c.phone ?? "",
          c.purchases,
          Number(c.spent),
          new Date(c.lastPurchase).toLocaleDateString("en-GB"),
          c.stores.join(", "),
        ],
        `pos-customers-${new Date().toISOString().slice(0, 10)}.xlsx`,
        reportTitle(`POS Customers — ${storeName}`, periodParams(period)),
      );
      toast.push(`Exported ${n} customer${n === 1 ? "" : "s"}`, "success");
    } catch (e) {
      toast.push((e as Error).message);
    } finally {
      setExporting(false);
    }
  };
  const { data, isLoading, error } = useQuery({
    queryKey: ["pos-customer-list", params],
    queryFn: () => proxyFetch<Page>(`/admin/pos/customers/summary?${params}`),
    placeholderData: (prev) => prev,
  });
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const showStores = !fixedStore;
  const spentOnPage = (data?.items ?? []).reduce(
    (s, c) => s + Number(c.spent),
    0,
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        {(
          [
            ["Customers", data ? String(data.total) : "—", "groups"],
            ["Spent (this page)", data ? taka(spentOnPage) : "—", "payments"],
          ] as const
        ).map(([label, v, icon]) => (
          <div
            key={label}
            className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
          >
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-emerald-50 text-[#1d7a46]">
              <Icon name={icon} size={26} />
            </span>
            <div className="flex-1">
              <div className="text-sm text-gray-600">{label}</div>
              <div className="text-3xl font-extrabold">{v}</div>
            </div>
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-emerald-50 text-[#1d7a46]">
              <Icon name={icon} size={22} />
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 pb-4 pt-1">
          {showStores && stores && (
            <label className={fieldBox}>
              <Icon name="storefront" size={20} className="text-[#1d7a46]" />
              <select
                value={storeFilter ?? ""}
                onChange={(e) => {
                  setStoreFilter(
                    e.target.value ? Number(e.target.value) : null,
                  );
                  setPage(1);
                }}
                className="bg-transparent pr-2 outline-none"
                aria-label="Store"
              >
                <option value="">All stores</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className={fieldBox}>
            <Icon
              name="workspace_premium"
              size={20}
              className="text-[#1d7a46]"
            />
            <select
              value={tier}
              onChange={(e) => {
                setTier(e.target.value);
                setPage(1);
              }}
              className="bg-transparent pr-2 outline-none"
              aria-label="Tier"
            >
              <option value="">All tiers</option>
              {tierList.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className={`${fieldBox} min-w-[240px] flex-1`}>
            <Icon name="search" size={20} className="text-gray-500" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search name or phone..."
              className="flex-1 bg-transparent outline-none"
            />
          </label>
          <PeriodFilter
            value={period}
            onChange={(p) => {
              setPeriod(p);
              setPage(1);
            }}
          />
          <button
            onClick={exportExcel}
            disabled={exporting || !data?.total}
            className="flex h-11 items-center gap-2 rounded-xl bg-[#1d7a46] px-4 text-sm font-bold text-white hover:bg-[#186a3c] disabled:opacity-50"
          >
            <Icon name="download" size={20} />
            {exporting ? "Exporting…" : "Export Excel"}
          </button>
        </div>
        <div className="overflow-x-auto rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-[#1d7a46] text-left text-white">
              <tr>
                <th className="px-5 py-4 font-bold">Customer</th>
                <th className="px-4 font-bold">Phone</th>
                <th className="px-4 text-center font-bold">Purchases</th>
                <th className="px-4 font-bold">Total spent</th>
                <th className="px-4 font-bold">Last purchase</th>
                <th className="px-4 font-bold">
                  {showStores ? "Stores & tier" : "Tier"}
                </th>
                <th className="px-4" />
              </tr>
            </thead>
            <tbody>
              {(isLoading || error || data?.items.length === 0) && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-10 text-center text-gray-500"
                  >
                    {isLoading
                      ? "Loading…"
                      : error
                        ? (error as Error).message
                        : "No customers yet. Customers appear here after a sale with a phone number."}
                  </td>
                </tr>
              )}
              {data?.items.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-gray-100 hover:bg-emerald-50/40"
                >
                  <td className="px-5 py-4">
                    <span className="flex items-center gap-3 font-semibold">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-50 text-sm font-bold text-[#1d7a46]">
                        {c.name.slice(0, 1).toUpperCase()}
                      </span>
                      {c.name}
                    </span>
                  </td>
                  <td className="px-4">{c.phone ?? "—"}</td>
                  <td className="px-4 text-center">{c.purchases}</td>
                  <td className="whitespace-nowrap px-4 text-base font-extrabold">
                    {taka(Number(c.spent))}
                  </td>
                  <td className="whitespace-nowrap px-4 text-gray-600">
                    {new Date(c.lastPurchase).toLocaleDateString("en-GB")}
                    <div className="text-xs font-semibold text-[#1d7a46]">
                      {daysAgo(c.lastPurchase, now)}
                    </div>
                  </td>
                  <td className="px-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {c.tiers.map((t) => (
                        <span
                          key={t.store}
                          className="inline-flex items-center gap-1"
                        >
                          {showStores && (
                            <span className="text-xs font-semibold text-gray-600">
                              {t.store}
                            </span>
                          )}
                          {t.name ? (
                            <TierBadge
                              name={t.name}
                              color={t.color ?? "#1d7a46"}
                            />
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 text-right">
                    <button
                      onClick={() => setHistory(c)}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-bold text-[#1d7a46] hover:bg-emerald-50"
                    >
                      Orders <Icon name="arrow_forward" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-3 pt-4 text-sm text-gray-600">
          <span>
            {data?.total ?? 0} customer{data?.total === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            <button
              className="h-10 rounded-xl border border-gray-200 px-4 disabled:opacity-40"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <span>
              Page {page} of {pages}
            </span>
            <button
              className="h-10 rounded-xl border border-gray-200 px-4 disabled:opacity-40"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
      {history && (
        <CustomerHistoryDialog
          customer={history}
          storeId={storeId}
          ordersHref={history.phone ? ordersHref(history.phone) : undefined}
          onClose={() => setHistory(null)}
        />
      )}
    </div>
  );
}

/**
 * POS Customer Manager: Customers (with tiers) | Tiers | SMS.
 * `storeId` fixed = one shop; `stores` given = every store (admin panel).
 */
export function PosCustomersManager(
  props: Parameters<typeof CustomersList>[0] & {
    can: (perm: string) => boolean;
  },
) {
  const { can, ...list } = props;
  const [tab, setTab] = useState<"list" | "tiers" | "sms">("list");
  const tabs = [
    ["list", "Customers", "groups"],
    ["tiers", "Tiers", "workspace_premium"],
    ...(can("pos.sms") ? [["sms", "SMS", "sms"]] : []),
  ] as ["list" | "tiers" | "sms", string, string][];
  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-2xl border border-gray-100 bg-white p-1.5 shadow-sm">
        {tabs.map(([t, label, icon]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold ${tab === t ? "bg-[#1d7a46] text-white" : "text-gray-600 hover:bg-gray-50"}`}
          >
            <Icon name={icon} size={20} /> {label}
          </button>
        ))}
      </div>
      {tab === "list" && <CustomersList {...list} />}
      {tab !== "list" && (
        <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
          {tab === "tiers" ? (
            <PosTiersTab canEdit={can("pos.settings")} />
          ) : (
            <PosSmsCampaignsTab storeId={list.storeId} stores={list.stores} />
          )}
        </div>
      )}
    </div>
  );
}
