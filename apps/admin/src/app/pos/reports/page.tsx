"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/components/ToastProvider";
import { proxyFetch } from "@/lib/api/proxy-client";
import { qs } from "@/hooks/usePos";
import { downloadCsvAsXlsx, reportTitle } from "@/lib/reportExport";
import { taka } from "@/lib/pos-cart";
import { usePosContext } from "@/components/pos/PosContext";
import { PosSubPage, card, input } from "@/components/pos/PosSubPage";

interface SalesRow {
  storeId: number;
  storeName: string;
  orders: number;
  gross: string;
  vat: string;
  returns: string;
}
interface ProfitRow {
  storeId: number;
  storeName: string;
  gross: string;
  returns: string;
  vat: string;
  netSales: string;
  expenses: string;
  profit: string;
}
interface StockRow {
  productId: number;
  variantId: number | null;
  name: string;
  sku: string | null;
  quantity: number;
}

// Dhaka calendar day — the server reports in Dhaka days too.
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
const exportBtn =
  "h-10 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold hover:bg-gray-50";

export default function PosReportsPage() {
  const { storeId, allStores, store } = usePosContext();
  const toast = useToast();
  const [tab, setTab] = useState<"sales" | "profit" | "stock">("sales");
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [everyStore, setEveryStore] = useState(false);
  const scopeId = allStores && everyStore ? undefined : storeId;
  const storeLabel =
    allStores && everyStore ? "All stores" : (store?.name ?? "");

  const sales = useQuery({
    queryKey: ["pos-report-sales", scopeId, from, to, everyStore],
    queryFn: () =>
      proxyFetch<SalesRow[]>(
        `/admin/pos/reports/sales${qs({ storeId: scopeId, from, to })}`,
      ),
    enabled: tab === "sales",
  });
  const profit = useQuery({
    queryKey: ["pos-report-profit", scopeId, from, to, everyStore],
    queryFn: () =>
      proxyFetch<ProfitRow[]>(
        `/admin/pos/reports/profit${qs({ storeId: scopeId, from, to })}`,
      ),
    enabled: tab === "profit",
  });
  const stock = useQuery({
    queryKey: ["pos-report-stock", storeId],
    queryFn: () =>
      proxyFetch<StockRow[]>(`/admin/pos/reports/stock${qs({ storeId })}`),
    enabled: tab === "stock",
  });

  const exportFile = (path: string, name: string, title: string) =>
    downloadCsvAsXlsx(`/api/backend${path}`, name, title).catch((e: Error) =>
      toast.push(e.message),
    );
  const range = { from, to };

  const tabBtn = (t: typeof tab, label: string) => (
    <button
      onClick={() => setTab(t)}
      className={`h-10 rounded-lg px-4 text-sm font-semibold ${tab === t ? "bg-[#1d7a46] text-white" : "border border-gray-200 bg-white"}`}
    >
      {label}
    </button>
  );

  const rangeBar = (
    <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
      <input
        type="date"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        className={input}
        aria-label="From"
      />
      <span>to</span>
      <input
        type="date"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        className={input}
        aria-label="To"
      />
      {allStores && (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={everyStore}
            onChange={(e) => setEveryStore(e.target.checked)}
          />{" "}
          All stores
        </label>
      )}
    </div>
  );

  return (
    <PosSubPage title="Reports" permission="pos.reports">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tabBtn("sales", "Sales")}
        {tabBtn("profit", "Store profit")}
        {tabBtn("stock", "Stock on hand")}
      </div>

      {/* Per-store Excel sheets — always for the one selected store. */}
      <div className={`${card} mb-4 flex flex-wrap items-center gap-2`}>
        <span className="mr-2 text-sm font-semibold">
          Excel for {store?.name}:
        </span>
        <button
          className={exportBtn}
          onClick={() =>
            exportFile(
              `/admin/pos/reports/sales-lines.csv${qs({ storeId, from, to })}`,
              `sales-${store?.code ?? "store"}-${from}-${to}`,
              reportTitle(`${store?.name ?? ""} Sales`, range),
            )
          }
        >
          Sales sheet
        </button>
        <button
          className={exportBtn}
          onClick={() =>
            exportFile(
              `/admin/pos/reports/customers.csv${qs({ storeId, from, to })}`,
              `customers-${store?.code ?? "store"}-${from}-${to}`,
              reportTitle(`${store?.name ?? ""} Customers`, range),
            )
          }
        >
          Customer sheet
        </button>
        <span className="text-xs text-gray-500">
          Uses the date range below.
        </span>
      </div>

      {tab === "sales" && (
        <div className={card}>
          <div className="flex items-start justify-between gap-3">
            {rangeBar}
            <button
              className={exportBtn}
              onClick={() =>
                exportFile(
                  `/admin/pos/reports/sales.csv${qs({ storeId: scopeId, from, to })}`,
                  `pos-sales-${from}-${to}`,
                  reportTitle(`POS Sales — ${storeLabel}`, range),
                )
              }
            >
              Export
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="py-2">Store</th>
                <th className="text-right">Sales</th>
                <th className="text-right">Gross</th>
                <th className="text-right">VAT</th>
                <th className="text-right">Returns</th>
              </tr>
            </thead>
            <tbody>
              {sales.data?.map((r) => (
                <tr key={r.storeId} className="border-t border-gray-100">
                  <td className="py-2 font-semibold">{r.storeName}</td>
                  <td className="text-right">{r.orders}</td>
                  <td className="text-right">{taka(r.gross)}</td>
                  <td className="text-right">{taka(r.vat)}</td>
                  <td className="text-right">{taka(r.returns)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {sales.data?.length === 0 && (
            <div className="py-6 text-center text-sm text-gray-500">
              No POS sales in this period.
            </div>
          )}
        </div>
      )}

      {tab === "profit" && (
        <div className={card}>
          <div className="flex items-start justify-between gap-3">
            {rangeBar}
            <button
              className={exportBtn}
              onClick={() =>
                exportFile(
                  `/admin/pos/reports/profit.csv${qs({ storeId: scopeId, from, to })}`,
                  `store-profit-${from}-${to}`,
                  reportTitle(`Store Profit — ${storeLabel}`, range),
                )
              }
            >
              Export
            </button>
          </div>
          <p className="mb-3 text-xs text-gray-500">
            Net sales = gross − returns − VAT. Expenses are those booked in
            Accounts to the store&apos;s cost centre (before VAT). Cost of goods
            is not included.
          </p>
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="py-2">Store</th>
                <th className="text-right">Gross</th>
                <th className="text-right">Returns</th>
                <th className="text-right">VAT</th>
                <th className="text-right">Net sales</th>
                <th className="text-right">Expenses</th>
                <th className="text-right">Profit</th>
              </tr>
            </thead>
            <tbody>
              {profit.data?.map((r) => (
                <tr key={r.storeId} className="border-t border-gray-100">
                  <td className="py-2 font-semibold">{r.storeName}</td>
                  <td className="text-right">{taka(r.gross)}</td>
                  <td className="text-right">{taka(r.returns)}</td>
                  <td className="text-right">{taka(r.vat)}</td>
                  <td className="text-right">{taka(r.netSales)}</td>
                  <td className="text-right">{taka(r.expenses)}</td>
                  <td
                    className={`text-right font-bold ${Number(r.profit) < 0 ? "text-red-600" : "text-emerald-700"}`}
                  >
                    {taka(r.profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {profit.data?.length === 0 && (
            <div className="py-6 text-center text-sm text-gray-500">
              Nothing in this period.
            </div>
          )}
        </div>
      )}

      {tab === "stock" && (
        <div className={card}>
          <div className="mb-4 flex items-center justify-between text-sm">
            <span className="font-semibold">{store?.name}</span>
            <button
              className={exportBtn}
              onClick={() =>
                exportFile(
                  `/admin/pos/reports/stock.csv${qs({ storeId })}`,
                  `stock-${store?.code ?? "store"}-${today()}`,
                  `Stock on hand — ${store?.name ?? ""}`,
                )
              }
            >
              Export
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="py-2">Product</th>
                <th>SKU</th>
                <th className="text-right">On hand</th>
              </tr>
            </thead>
            <tbody>
              {stock.data?.map((r) => (
                <tr
                  key={`${r.productId}:${r.variantId ?? 0}`}
                  className="border-t border-gray-100"
                >
                  <td className="py-2">{r.name}</td>
                  <td className="font-mono text-xs">{r.sku ?? ""}</td>
                  <td
                    className={`text-right font-semibold ${r.quantity <= 0 ? "text-red-600" : r.quantity <= 10 ? "text-orange-600" : ""}`}
                  >
                    {r.quantity >= 9999 ? "untracked" : r.quantity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PosSubPage>
  );
}
