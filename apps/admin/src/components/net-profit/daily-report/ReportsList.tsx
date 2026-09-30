"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card } from "@amader/admin-ui";
import {
  dailyReportExportUrl,
  useDailyReports,
  useDeleteDailyReport,
} from "@/hooks/useDailyReports";
import { GenerateModal } from "./GenerateModal";
import { inputClass, money } from "./format";

export function ReportsList({ canManage }: { canManage: boolean }) {
  const [date, setDate] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const list = useDailyReports({ date, q, page });
  const del = useDeleteDailyReport();
  const pages = list.data
    ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize))
    : 1;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          Report date
          <input
            type="date"
            className={inputClass}
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          Name
          <input
            type="search"
            className={inputClass}
            value={q}
            placeholder="Search by name"
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </label>
        {(date || q) && (
          <Button
            variant="link"
            onClick={() => {
              setDate("");
              setQ("");
              setPage(1);
            }}
          >
            Clear
          </Button>
        )}
        <div className="flex-1" />
        {canManage && (
          <Button onClick={() => setOpen(true)}>Generate report</Button>
        )}
      </div>
      <p className="text-xs text-muted">
        A report for the previous day is created automatically every night after
        12 AM. Reports are kept for 45 days.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-muted">
              <th className="py-2 pr-3">Name</th>
              <th className="pr-3">Period</th>
              <th className="pr-3">Type</th>
              <th className="pr-3 text-right">Sales</th>
              <th className="pr-3 text-right">Net profit</th>
              <th className="pr-3">Created by</th>
              <th className="pr-3">Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((r) => (
              <tr key={r.id} className="border-b border-border">
                <td className="py-2 pr-3">
                  <Link
                    href={`/net-profit/daily-report/${r.id}`}
                    className="font-semibold text-brand-500 hover:underline"
                  >
                    {r.name}
                  </Link>
                </td>
                <td className="pr-3">
                  {r.from === r.to ? r.from : `${r.from} → ${r.to}`}
                </td>
                <td className="pr-3">
                  {r.kind === "AUTO" ? "Auto" : "Manual"}
                </td>
                <td className="pr-3 text-right tabular-nums">
                  {money(r.totalSales)}
                </td>
                <td
                  className={`pr-3 text-right tabular-nums ${r.netProfit < 0 ? "text-danger" : ""}`}
                >
                  {money(r.netProfit)}
                </td>
                <td className="pr-3">{r.createdByName ?? "System"}</td>
                <td className="pr-3">
                  {new Date(r.createdAt).toLocaleString("en-GB", {
                    timeZone: "Asia/Dhaka",
                  })}
                </td>
                <td className="whitespace-nowrap text-right">
                  <a
                    href={dailyReportExportUrl(r.id)}
                    className="mr-3 text-brand-500 hover:underline"
                  >
                    Excel
                  </a>
                  {canManage && (
                    <button
                      type="button"
                      className="text-danger hover:underline"
                      disabled={del.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete "${r.name}"? This cannot be undone.`,
                          )
                        )
                          del.mutate(r.id);
                      }}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {list.data && list.data.items.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-muted">
                  No reports found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {list.isLoading && (
          <p className="py-6 text-center text-muted">Loading…</p>
        )}
        {list.error && (
          <p className="py-6 text-center text-danger">
            {(list.error as Error).message}
          </p>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button
            variant="ghost"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span>
            Page {page} of {pages}
          </span>
          <Button
            variant="ghost"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
      {canManage && (
        <GenerateModal open={open} onClose={() => setOpen(false)} />
      )}
    </Card>
  );
}
