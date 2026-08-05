"use client";

import { useState } from "react";
import {
  useAssignableStaff,
  useBulkCustomerAction,
  useCustomers,
  useCustomerStats,
  useCustomerTiers,
  type AdminCustomerListItem,
  type CustomerListFilters,
} from "@/hooks/useCustomers";
import { CustomerStatsStrip } from "@/components/customers/CustomerStatsStrip";
import { CustomerFilters, type CustomerFilterState } from "@/components/customers/CustomerFilters";
import { CustomersTable } from "@/components/customers/CustomersTable";
import { CustomerDetailModal } from "@/components/CustomerDetailModal";
import { CustomerImportModal } from "@/components/customers/CustomerImportModal";
import { CreateCustomerModal } from "@/components/orders/CreateCustomerModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DeletedCustomersTab } from "./DeletedCustomersTab";

const GREEN = "#2e7d43";
const GREEN_DARK = "#1d5230";
const LINE = "#e5ebe6";
const INK = "#1e2b22";
const MUTED = "#64766b";
const TEXT = "#374840";

const DEFAULT_FILTERS: CustomerFilterState = { q: "" };

function HeaderButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 items-center gap-2 rounded-[10px] border px-[15px] text-[0.8rem] font-bold transition-colors duration-150 hover:bg-[#f2f6f3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2e7d43] focus-visible:ring-offset-1"
      style={{ borderColor: LINE, color: TEXT }}
    >
      {children}
    </button>
  );
}

export default function CustomersPage() {
  const [section, setSection] = useState<"customers" | "deleted">("customers");
  const [uiFilters, setUiFilters] = useState<CustomerFilterState>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  // Single-row target xor "bulk" (current `selected` set) — one ConfirmDialog
  // covers both the per-row trash icon and the bulk-action-bar Delete button.
  const [deleteTarget, setDeleteTarget] = useState<AdminCustomerListItem | "bulk" | null>(null);

  const queryFilters: CustomerListFilters = { ...uiFilters, page, pageSize };
  const { data: stats } = useCustomerStats();
  const { data } = useCustomers(queryFilters);
  const { data: tiers } = useCustomerTiers();
  const { data: staff } = useAssignableStaff();
  const bulk = useBulkCustomerAction();

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!data) return;
    setSelected((prev) => (prev.size === data.items.length ? new Set() : new Set(data.items.map((c) => c.id))));
  }

  function confirmDelete() {
    const customerIds = deleteTarget === "bulk" ? [...selected] : deleteTarget ? [deleteTarget.id] : [];
    if (customerIds.length === 0) {
      setDeleteTarget(null);
      return;
    }
    bulk.mutate(
      { customerIds, action: "delete" },
      { onSuccess: () => setSelected(new Set()) },
    );
    setDeleteTarget(null);
  }

  function exportHref() {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(uiFilters)) {
      if (v !== undefined && v !== "") params.set(k, String(v));
    }
    const s = params.toString();
    return `/api/backend/admin/customers/export${s ? `?${s}` : ""}`;
  }

  function handleFiltersChange(next: CustomerListFilters) {
    if (next.page !== undefined || next.pageSize !== undefined) {
      if (next.page !== undefined) setPage(next.page);
      if (next.pageSize !== undefined) setPageSize(next.pageSize);
      return;
    }
    setUiFilters(next as CustomerFilterState);
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.45rem] font-extrabold tracking-tight" style={{ color: INK }}>
            Customer Management
          </h1>
          <div className="mt-1.5 flex items-center gap-1.5 text-[0.76rem] font-semibold" style={{ color: MUTED }}>
            Dashboard <span style={{ color: "#94a69a" }}>›</span> <span style={{ color: GREEN }}>Customers</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <HeaderButton onClick={() => setSection(section === "deleted" ? "customers" : "deleted")}>
            {section === "deleted" ? "Back to Customers" : "Deleted Customers"}
          </HeaderButton>
          <a
            href={exportHref()}
            className="inline-flex h-10 items-center gap-2 rounded-[10px] border px-[15px] text-[0.8rem] font-bold"
            style={{ borderColor: LINE, color: TEXT }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export
          </a>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-[10px] border px-[15px] text-[0.8rem] font-bold"
            style={{ borderColor: LINE, color: TEXT }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Import
          </button>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-[10px] px-4 text-[0.82rem] font-bold text-white"
            style={{ background: GREEN }}
            onMouseEnter={(e) => (e.currentTarget.style.background = GREEN_DARK)}
            onMouseLeave={(e) => (e.currentTarget.style.background = GREEN)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Customer
          </button>
        </div>
      </div>

      {section === "deleted" ? (
        <DeletedCustomersTab />
      ) : (
        <>
          <CustomerStatsStrip stats={stats} />

          <CustomerFilters
            filters={uiFilters}
            onChange={(next) => {
              setUiFilters(next);
              setPage(1);
            }}
            onReset={() => {
              setUiFilters(DEFAULT_FILTERS);
              setPage(1);
            }}
            tiers={tiers}
            staff={staff}
          />

          <div className="flex flex-wrap items-center gap-2.5 rounded-card border p-[12px_16px] shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: LINE }}>
            <span className="text-[0.76rem] font-semibold" style={{ color: MUTED }}>
              {selected.size > 0 ? `${selected.size} selected` : "Select customers to act on"}
            </span>
            <button
              type="button"
              disabled={selected.size === 0 || bulk.isPending}
              onClick={() => setDeleteTarget("bulk")}
              className="inline-flex h-[38px] items-center rounded-[9px] border px-3.5 text-[0.75rem] font-bold disabled:opacity-40"
              style={{ borderColor: "#f8ccd3", background: "#feeaec", color: "#e5484d" }}
            >
              Delete
            </button>
            <span className="ml-auto text-[0.76rem] font-semibold" style={{ color: MUTED }}>
              {data?.total ?? 0} customers
            </span>
          </div>

          <CustomersTable
            customers={data?.items ?? []}
            total={data?.total ?? 0}
            filters={{ ...queryFilters }}
            onFiltersChange={handleFiltersChange}
            staff={staff}
            onView={setSelectedId}
            selected={selected}
            onToggle={toggle}
            onToggleAll={toggleAll}
            onDelete={setDeleteTarget}
          />
        </>
      )}

      {selectedId && <CustomerDetailModal customerId={selectedId} onClose={() => setSelectedId(null)} />}
      {importOpen && <CustomerImportModal onClose={() => setImportOpen(false)} />}
      <CreateCustomerModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(customer) => {
          setAddOpen(false);
          setSelectedId(customer.id);
        }}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        pending={bulk.isPending}
        title={deleteTarget === "bulk" ? `Delete ${selected.size} customer(s)?` : `Delete ${deleteTarget?.name}?`}
        description="This moves the customer to Deleted Customers, not a permanent delete — it can be restored from there at any time."
      />
    </div>
  );
}
