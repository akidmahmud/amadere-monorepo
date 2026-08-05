"use client";

import { useState } from "react";
import { CustomersTable } from "@/components/customers/CustomersTable";
import { useAssignableStaff, useBulkCustomerAction, useDeletedCustomers } from "@/hooks/useCustomers";
import { CustomerDetailModal } from "@/components/CustomerDetailModal";

const MUTED = "#64766b";
const LINE = "#e5ebe6";
const GREEN = "#2e7d43";

// Same table component the main "Customers" list uses (full column set,
// green header, inline-editable cells) — the only difference is the data
// source (soft-deleted rows) and the row action (Restore instead of Delete).
export function DeletedCustomersTab() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { data } = useDeletedCustomers({ page, pageSize });
  const { data: staff } = useAssignableStaff();
  const bulk = useBulkCustomerAction();
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  function handleRestore(customer: { id: number }) {
    setRestoringId(customer.id);
    bulk.mutate(
      { customerIds: [customer.id], action: "restore" },
      { onSettled: () => setRestoringId(null) },
    );
  }

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

  function bulkRestore() {
    if (selected.size === 0) return;
    bulk.mutate(
      { customerIds: [...selected], action: "restore" },
      { onSuccess: () => setSelected(new Set()) },
    );
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <p className="text-[0.8rem] font-semibold" style={{ color: MUTED }}>
        Customers deleted from the working list — nothing here is purged automatically, so anything can be restored
        whenever it's needed.
      </p>

      <div className="flex flex-wrap items-center gap-2.5 rounded-card border p-[12px_16px] shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: LINE }}>
        <span className="text-[0.76rem] font-semibold" style={{ color: MUTED }}>
          {selected.size > 0 ? `${selected.size} selected` : "Select customers to restore"}
        </span>
        <button
          type="button"
          disabled={selected.size === 0 || bulk.isPending}
          onClick={bulkRestore}
          className="inline-flex h-[38px] items-center rounded-[9px] border px-3.5 text-[0.75rem] font-bold text-white disabled:opacity-40"
          style={{ borderColor: GREEN, background: GREEN }}
        >
          Restore
        </button>
        <span className="ml-auto text-[0.76rem] font-semibold" style={{ color: MUTED }}>
          {data?.total ?? 0} deleted customers
        </span>
      </div>

      <CustomersTable
        customers={data?.items ?? []}
        total={data?.total ?? 0}
        filters={{ page, pageSize }}
        onFiltersChange={(next) => {
          if (next.page !== undefined) setPage(next.page);
          if (next.pageSize !== undefined) setPageSize(next.pageSize);
        }}
        staff={staff}
        onView={setSelectedId}
        selected={selected}
        onToggle={toggle}
        onToggleAll={toggleAll}
        onRestore={handleRestore}
        restoringId={restoringId}
      />

      {selectedId && <CustomerDetailModal customerId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
