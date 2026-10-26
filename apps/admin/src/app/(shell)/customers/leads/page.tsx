"use client";

import { useState } from "react";
import { Modal } from "@amader/admin-ui";
import { useCan } from "@/hooks/useAdminAuth";
import { useAssignableStaff } from "@/hooks/useCustomers";
import {
  LEAD_SOURCES,
  LEAD_STATUS_LABEL,
  useCreateLead,
  useDeleteLead,
  useLeads,
  type Lead,
  type LeadFilters,
  type LeadStatus,
} from "@/hooks/useLeads";
import { TH } from "@/components/customers/CustomersTable";
import { CustomerImportModal } from "@/components/customers/CustomerImportModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LeadDetailModal } from "@/components/leads/LeadDetailModal";
import { LeadDashboard } from "@/components/leads/LeadDashboard";
import { DeletedLeads } from "@/components/leads/DeletedLeads";

// Same palette as Customer Management.
const GREEN = "#2e7d43";
const GREEN_DARK = "#1d5230";
const LINE = "#e5ebe6";
const INK = "#1e2b22";
const MUTED = "#64766b";
const TEXT = "#374840";
const FAINT = "#94a69a";
const local = (p: string) => (p.startsWith("880") ? `0${p.slice(3)}` : p);
const day = (v: string | null) => (v ? new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }) : "—");
const td = "px-3 py-2.5 text-[0.8rem] whitespace-nowrap";
const control = "h-10 rounded-[10px] border bg-white px-3 text-[0.8rem] font-semibold";

const STATUS_STYLE: Record<LeadStatus, { bg: string; color: string }> = {
  NEW: { bg: "#eef4ff", color: "#1d4ed8" },
  CONTACTED: { bg: "#f1f5f9", color: "#475569" },
  INTERESTED: { bg: "#e8f5ec", color: GREEN },
  FOLLOW_UP: { bg: "#fff7e6", color: "#b45309" },
  CONVERTED: { bg: "#e8f5ec", color: GREEN },
  LOST: { bg: "#fdecee", color: "#be123c" },
  DNC: { bg: "#fdecee", color: "#9f1239" },
};

function AddLeadModal({ onClose }: { onClose: () => void }) {
  const create = useCreateLead();
  const [f, setF] = useState({ phone: "", name: "", leadSource: "Inbound call", interestedProduct: "" });
  return (
    <Modal open onClose={onClose} title="Add lead">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(
            { phone: f.phone, name: f.name || null, leadSource: f.leadSource || null, interestedProduct: f.interestedProduct || null },
            { onSuccess: onClose },
          );
        }}
      >
        {(
          [
            ["phone", "Phone *", "017XXXXXXXX"],
            ["name", "Name (if known)", ""],
            ["interestedProduct", "Interested product", "e.g. Sorishar tel 5 ltr"],
          ] as const
        ).map(([k, label, ph]) => (
          <label key={k} className="flex flex-col gap-1 text-[0.74rem] font-bold" style={{ color: MUTED }}>
            {label}
            <input
              required={k === "phone"}
              value={f[k]}
              placeholder={ph}
              onChange={(e) => setF({ ...f, [k]: e.target.value })}
              className="h-10 rounded-lg border px-3 text-sm font-normal text-[#1e2b22]"
              style={{ borderColor: LINE }}
            />
          </label>
        ))}
        <label className="flex flex-col gap-1 text-[0.74rem] font-bold" style={{ color: MUTED }}>
          Lead source
          <select value={f.leadSource} onChange={(e) => setF({ ...f, leadSource: e.target.value })} className="h-10 rounded-lg border px-3 text-sm" style={{ borderColor: LINE }}>
            {LEAD_SOURCES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        {create.isError && <p className="text-xs font-semibold text-rose-600">{(create.error as Error).message}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-lg border px-4 text-sm font-bold" style={{ borderColor: LINE, color: TEXT }}>
            Cancel
          </button>
          <button type="submit" disabled={create.isPending} className="h-10 rounded-lg px-4 text-sm font-bold text-white disabled:opacity-50" style={{ background: GREEN }}>
            {create.isPending ? "Adding…" : "Add lead"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Lead Center: people who called or messaged but haven't ordered — usually
 * just a phone number. Click one to call and fill them in; New Order turns
 * them into a customer (they then leave this list).
 */
export default function LeadCenterPage() {
  const canManage = useCan("customer.manage");
  const canDelete = useCan("customer.delete");
  const { data: staff } = useAssignableStaff();
  const [section, setSection] = useState<"leads" | "dashboard" | "deleted">("leads");
  const [filters, setFilters] = useState<LeadFilters>({ page: 1, pageSize: 20 });
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Lead | null>(null);
  const del = useDeleteLead();
  const { data, isLoading } = useLeads(filters);
  const set = (patch: LeadFilters) => setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.45rem] font-extrabold tracking-tight" style={{ color: INK }}>
            Lead Center
          </h1>
          <div className="mt-1.5 flex items-center gap-1.5 text-[0.76rem] font-semibold" style={{ color: MUTED }}>
            Customers <span style={{ color: FAINT }}>›</span> <span style={{ color: GREEN }}>Lead Center</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={!canManage}
            onClick={() => setImportOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-[10px] border px-[15px] text-[0.8rem] font-bold disabled:opacity-40"
            style={{ borderColor: LINE, color: TEXT }}
          >
            Import Excel
          </button>
          <button
            type="button"
            disabled={!canManage}
            onClick={() => setAddOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-[10px] px-4 text-[0.82rem] font-bold text-white disabled:opacity-40"
            style={{ background: GREEN }}
            onMouseEnter={(e) => (e.currentTarget.style.background = GREEN_DARK)}
            onMouseLeave={(e) => (e.currentTarget.style.background = GREEN)}
          >
            + Add lead
          </button>
        </div>
      </div>

      <div className="flex gap-1.5 border-b" style={{ borderColor: LINE }}>
        {(
          [
            ["leads", `Leads${data ? ` (${data.total})` : ""}`],
            ["dashboard", "Dashboard"],
            ["deleted", "Deleted leads"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setSection(k)}
            className="-mb-px border-b-2 px-4 py-2 text-sm font-bold"
            style={section === k ? { borderColor: GREEN, color: GREEN } : { borderColor: "transparent", color: MUTED }}
          >
            {label}
          </button>
        ))}
      </div>

      {section === "dashboard" ? (
        <LeadDashboard />
      ) : section === "deleted" ? (
        <DeletedLeads />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && set({ q: search })}
              onBlur={() => set({ q: search })}
              placeholder="Search phone, name or product…"
              className={`${control} min-w-[240px] flex-1 font-normal`}
              style={{ borderColor: LINE }}
            />
            <select value={filters.status ?? ""} onChange={(e) => set({ status: e.target.value as LeadStatus | "" })} className={control} style={{ borderColor: LINE }}>
              <option value="">All statuses</option>
              {Object.entries(LEAD_STATUS_LABEL)
                .filter(([v]) => v !== "CONVERTED")
                .map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
            </select>
            <select value={filters.assigned ?? ""} onChange={(e) => set({ assigned: e.target.value })} className={control} style={{ borderColor: LINE }}>
              <option value="">Assigned: anyone</option>
              <option value="none">Unassigned</option>
              {(staff ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <label className="inline-flex items-center gap-2 text-[0.8rem] font-semibold" style={{ color: TEXT }}>
              <input type="checkbox" checked={filters.view === "due"} onChange={(e) => set({ view: e.target.checked ? "due" : "" })} style={{ accentColor: GREEN }} />
              Due to call today
            </label>
          </div>

          <div className="overflow-hidden rounded-card border bg-white shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ borderColor: LINE }}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <TH style={{ minWidth: 200 }}>Name</TH>
                    <TH>Phone</TH>
                    <TH>Lead source</TH>
                    <TH>Lead date</TH>
                    <TH style={{ minWidth: 180 }}>Interested product</TH>
                    <TH>Assign to</TH>
                    <TH>Priority</TH>
                    <TH>Status</TH>
                    <TH>Last call</TH>
                    <TH>Next call</TH>
                    <TH>Calls</TH>
                    <TH style={{ minWidth: 200 }}>Customer feedback</TH>
                    <TH>Actions</TH>
                  </tr>
                </thead>
                <tbody>
                  {(isLoading || data?.items.length === 0) && (
                    <tr>
                      <td colSpan={13} className="px-3 py-10 text-center text-sm" style={{ color: FAINT }}>
                        {isLoading ? "Loading…" : "No leads. Import your lead sheet or add one."}
                      </td>
                    </tr>
                  )}
                  {data?.items.map((l) => (
                    <tr key={l.id} className="border-b hover:bg-[#f7faf8]" style={{ borderColor: LINE }}>
                      <td className={td}>
                        {/* No name yet: the phone stands in, and opens the lead. */}
                        <button type="button" onClick={() => setOpenId(l.id)} className="font-bold hover:underline" style={{ color: l.name ? INK : GREEN }}>
                          {l.name || local(l.phone)}
                        </button>
                        <div className="text-[0.7rem]" style={{ color: FAINT }}>
                          #LEAD-{l.id}
                        </div>
                      </td>
                      <td className={td}>
                        <button type="button" onClick={() => setOpenId(l.id)} className="font-semibold hover:underline" style={{ color: GREEN }}>
                          {local(l.phone)}
                        </button>
                      </td>
                      <td className={td}>{l.leadSource ?? <span style={{ color: FAINT }}>—</span>}</td>
                      <td className={td}>{day(l.leadDate)}</td>
                      <td className={`${td} max-w-[220px] truncate`} title={l.interestedProduct ?? undefined}>
                        {l.interestedProduct ?? <span style={{ color: FAINT }}>—</span>}
                      </td>
                      <td className={td}>{l.assignedAdminName ?? <span style={{ color: FAINT }}>—</span>}</td>
                      <td className={td}>{l.priority ? l.priority.charAt(0) + l.priority.slice(1).toLowerCase() : <span style={{ color: FAINT }}>—</span>}</td>
                      <td className={td}>
                        <span className="rounded-pill px-2.5 py-1 text-[0.7rem] font-bold" style={{ background: STATUS_STYLE[l.status].bg, color: STATUS_STYLE[l.status].color }}>
                          {LEAD_STATUS_LABEL[l.status]}
                        </span>
                      </td>
                      <td className={td}>{day(l.lastCallAt)}</td>
                      <td className={td}>{day(l.nextCallDate)}</td>
                      <td className={td}>{l.callCount ?? 0}</td>
                      <td className={`${td} max-w-[240px] truncate`} title={l.customerFeedback ?? undefined}>
                        {l.customerFeedback ?? <span style={{ color: FAINT }}>—</span>}
                      </td>
                      <td className={td}>
                        {canDelete && (
                        <button
                          type="button"
                          onClick={() => setToDelete(l)}
                          title="Delete lead"
                          className="grid h-8 w-8 place-items-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                        >
                          ✕
                        </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-[0.78rem]" style={{ color: MUTED }}>
              <span>{data ? `${data.total} leads` : ""}</span>
              <div className="flex items-center gap-2">
                <button type="button" disabled={(filters.page ?? 1) <= 1} onClick={() => set({ page: (filters.page ?? 1) - 1 })} className="h-8 rounded-lg border px-3 font-bold disabled:opacity-40" style={{ borderColor: LINE }}>
                  ‹
                </button>
                <span>
                  {filters.page ?? 1} / {pages}
                </span>
                <button type="button" disabled={(filters.page ?? 1) >= pages} onClick={() => set({ page: (filters.page ?? 1) + 1 })} className="h-8 rounded-lg border px-3 font-bold disabled:opacity-40" style={{ borderColor: LINE }}>
                  ›
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {openId !== null && <LeadDetailModal leadId={openId} onClose={() => setOpenId(null)} />}
      {addOpen && <AddLeadModal onClose={() => setAddOpen(false)} />}
      {importOpen && (
        <CustomerImportModal
          onClose={() => setImportOpen(false)}
          endpoint="/api/backend/admin/leads/import"
          queryKey={["leads"]}
          title="Import Leads"
          noun="leads"
          intro="Upload your lead sheet (.xlsx or .csv) as it is. Columns are matched by their header (Name, Number, Lead source, Lead date, Interested product, Assign to, Priority, Call date, Next call date, Customer feedback…). Numbers that are already a lead or already a customer are skipped. Nothing is saved until you press Import."
        />
      )}
      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && del.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })}
        pending={del.isPending}
        title={`Delete lead ${toDelete ? toDelete.name || local(toDelete.phone) : ""}?`}
        description="The lead moves to Deleted leads, where it can be restored."
      />
    </div>
  );
}
