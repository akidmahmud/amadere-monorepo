"use client";

import { useState } from "react";
import { useCan } from "@/hooks/useAdminAuth";
import { LEAD_STATUS_LABEL, useDeletedLeads, useRestoreLead } from "@/hooks/useLeads";
import { TH } from "@/components/customers/CustomersTable";

const GREEN = "#2e7d43";
const LINE = "#e5ebe6";
const MUTED = "#64766b";
const FAINT = "#94a69a";
const local = (p: string) => (p.startsWith("880") ? `0${p.slice(3)}` : p);
const td = "px-3 py-2.5 text-[0.8rem] whitespace-nowrap";

/** Leads that were deleted, with Restore to put them back in Lead Center. */
export function DeletedLeads() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useDeletedLeads(page);
  const restore = useRestoreLead();
  const canManage = useCan("customer.manage");
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <div className="overflow-hidden rounded-card border bg-white shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ borderColor: LINE }}>
      {restore.isError && (
        <p className="border-b px-4 py-2.5 text-xs font-semibold text-rose-600" style={{ borderColor: LINE }}>
          {(restore.error as Error).message}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <TH style={{ minWidth: 200 }}>Name</TH>
              <TH>Phone</TH>
              <TH>Lead source</TH>
              <TH style={{ minWidth: 180 }}>Interested product</TH>
              <TH>Status</TH>
              <TH>Deleted</TH>
              <TH>Actions</TH>
            </tr>
          </thead>
          <tbody>
            {(isLoading || data?.items.length === 0) && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-sm" style={{ color: FAINT }}>
                  {isLoading ? "Loading…" : "No deleted leads."}
                </td>
              </tr>
            )}
            {data?.items.map((l) => (
              <tr key={l.id} className="border-b" style={{ borderColor: LINE }}>
                <td className={`${td} font-bold`}>{l.name || local(l.phone)}</td>
                <td className={td}>{local(l.phone)}</td>
                <td className={td}>{l.leadSource ?? "—"}</td>
                <td className={td}>{l.interestedProduct ?? "—"}</td>
                <td className={td}>{LEAD_STATUS_LABEL[l.status]}</td>
                <td className={td}>
                  {(l as typeof l & { deletedAt?: string }).deletedAt
                    ? new Date((l as typeof l & { deletedAt: string }).deletedAt).toLocaleDateString("en-GB")
                    : "—"}
                </td>
                <td className={td}>
                  <button
                    type="button"
                    disabled={!canManage || restore.isPending}
                    onClick={() => restore.mutate(l.id)}
                    className="h-8 rounded-[8px] border px-3 text-[0.72rem] font-bold disabled:opacity-40"
                    style={{ borderColor: GREEN, color: GREEN }}
                  >
                    Restore
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-4 py-3 text-[0.78rem]" style={{ color: MUTED }}>
        <span>{data ? `${data.total} deleted leads` : ""}</span>
        <div className="flex items-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="h-8 rounded-lg border px-3 font-bold disabled:opacity-40" style={{ borderColor: LINE }}>
            ‹
          </button>
          <span>
            {page} / {pages}
          </span>
          <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className="h-8 rounded-lg border px-3 font-bold disabled:opacity-40" style={{ borderColor: LINE }}>
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
