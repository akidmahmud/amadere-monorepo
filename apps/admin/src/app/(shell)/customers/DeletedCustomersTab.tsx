"use client";

import { useState } from "react";
import { CustomersTable } from "@/components/customers/CustomersTable";
import { useAssignableStaff, useBulkCustomerAction, useDeletedCustomers } from "@/hooks/useCustomers";
import { CustomerDetailModal } from "@/components/CustomerDetailModal";
import { useToast } from "@/components/ToastProvider";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const MUTED = "#64766b";
const LINE = "#e5ebe6";
const GREEN = "#2e7d43";
const DANGER = "#c0392b";

// Same table component the main "Customers" list uses (full column set,
// green header, inline-editable cells) — the only difference is the data
// source (soft-deleted rows) and the row action (Restore instead of Delete).
export function DeletedCustomersTab() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { data } = useDeletedCustomers({ page, pageSize });
  const { data: staff } = useAssignableStaff();
  const bulk = useBulkCustomerAction();
  const toast = useToast();
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmPurge, setConfirmPurge] = useState(false);

  // The bulk endpoint always 200s and reports per-customer success/failure
  // in the response body (e.g. a restore can legitimately conflict if
  // someone else has since registered that exact phone/email) — a mutation
  // "succeeding" doesn't mean every id in it did. Surfacing `failed` here
  // fixes a real silent-failure gap: restoring used to just do nothing
  // visible on a conflict, with the row staying in the trash and no
  // explanation why.
  function handleRestore(customer: { id: number }) {
    setRestoringId(customer.id);
    bulk.mutate(
      { customerIds: [customer.id], action: "restore" },
      {
        onSettled: () => setRestoringId(null),
        onSuccess: (result) => {
          if (result.failed.length > 0) toast.push(result.failed[0].error, "error");
        },
      },
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
      {
        onSuccess: (result) => {
          setSelected(new Set());
          if (result.failed.length > 0) {
            toast.push(
              result.failed.length === 1
                ? result.failed[0].error
                : `${result.failed.length} customers couldn't be restored — phone/email now used elsewhere`,
              "error",
            );
          }
        },
      },
    );
  }

  // Irreversible, unlike every other action on this screen — hence a
  // ConfirmDialog that spells out what survives (orders) and what doesn't,
  // rather than a native confirm() that can't.
  function bulkPurge() {
    if (selected.size === 0) return;
    bulk.mutate(
      { customerIds: [...selected], action: "purge" },
      {
        onSuccess: (result) => {
          setConfirmPurge(false);
          setSelected(new Set());
          if (result.failed.length > 0) {
            toast.push(
              result.failed.length === 1
                ? result.failed[0].error
                : `${result.failed.length} customers couldn't be permanently deleted`,
              "error",
            );
          } else {
            toast.push(`Permanently deleted ${result.succeeded.length} customer(s)`, "success");
          }
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <p className="text-[0.8rem] font-semibold" style={{ color: MUTED }}>
        Customers deleted from the working list — restorable any time within 30 days, after which they're
        automatically and permanently purged (nightly cleanup job).
      </p>

      <div className="flex flex-wrap items-center gap-2.5 rounded-card border p-[12px_16px] shadow-[0_1px_2px_rgba(20,40,25,.05)]" style={{ background: "#fff", borderColor: LINE }}>
        <span className="text-[0.76rem] font-semibold" style={{ color: MUTED }}>
          {selected.size > 0 ? `${selected.size} selected` : "Select customers to restore or delete permanently"}
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
        <button
          type="button"
          disabled={selected.size === 0 || bulk.isPending}
          onClick={() => setConfirmPurge(true)}
          className="inline-flex h-[38px] items-center rounded-[9px] border px-3.5 text-[0.75rem] font-bold text-white disabled:opacity-40"
          style={{ borderColor: DANGER, background: DANGER }}
        >
          Delete permanently
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

      <ConfirmDialog
        open={confirmPurge}
        onClose={() => setConfirmPurge(false)}
        onConfirm={bulkPurge}
        title="Delete permanently?"
        description={`This removes ${selected.size} customer(s) for good — there is no undo and no restore window. Their notes, call logs, saved addresses, wishlist, cart and reviews go with them. Past orders are kept for your records but will no longer be linked to a customer.`}
        confirmLabel="Delete permanently"
        pending={bulk.isPending}
      />

      {selectedId && <CustomerDetailModal customerId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
