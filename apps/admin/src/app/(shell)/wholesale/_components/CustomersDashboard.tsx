"use client";

import { useMemo, useState } from "react";
import { Button, Card, Icon, StatCard } from "@amader/admin-ui";
import {
  downloadWholesaleCustomersCsv,
  useBulkAssignWholesaleCustomers,
  useDeleteWholesaleCustomer,
  useWholesaleCustomers,
  useWholesaleStaff,
  useWholesaleStats,
  type WholesaleCustomer,
} from "@/hooks/useWholesale";
import { useCan } from "@/hooks/useAdminAuth";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CustomerImportModal } from "@/components/customers/CustomerImportModal";
import { DeletedWholesaleCustomers } from "./DeletedWholesaleCustomers";
import { WholesaleCustomersTable } from "./WholesaleCustomersTable";
import { Pager } from "./Pager";
import { WholesaleCustomerDetailModal } from "./WholesaleCustomerDetailModal";
import { DATE_RANGES, resolveDateRange } from "./OrdersDashboard";

const compactMoney = (v: string | number) =>
  `৳${Number(v || 0).toLocaleString("en-BD", { maximumFractionDigits: 0 })}`;

const INPUT =
  "h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none transition-all duration-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 placeholder:text-muted";

export function CustomersDashboard({
  onNewCustomer,
  onEditCustomer,
  onOrderFor,
}: {
  onNewCustomer: () => void;
  onEditCustomer: (c: WholesaleCustomer) => void;
  onOrderFor: (c: WholesaleCustomer) => void;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  // 6 by default, like Customer Management: the CRM table is very wide, and
  // with a long page its left-right scrollbar sat far below the screen.
  const [pageSize, setPageSize] = useState(6);
  const [detail, setDetail] = useState<WholesaleCustomer | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [customerToDelete, setCustomerToDelete] =
    useState<WholesaleCustomer | null>(null);
  const staff = useWholesaleStaff();
  const canDelete = useCan("wholesale.delete");
  const canAssign = useCan("assignment.manage");
  // "" = anyone, "0" = unassigned, else a staff id — same as retail's filter.
  const [assignee, setAssignee] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const bulkAssign = useBulkAssignWholesaleCustomers();
  const [assignError, setAssignError] = useState<string | null>(null);
  const deleteCustomer = useDeleteWholesaleCustomer();

  // Same presets and custom from/to as the order dashboards. A customer is
  // in the window when they placed an order inside it.
  const [dateRange, setDateRange] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const range = useMemo(
    () => resolveDateRange(dateRange, dateFrom, dateTo),
    [dateRange, dateFrom, dateTo],
  );

  const customers = useWholesaleCustomers(
    search,
    false,
    page,
    pageSize,
    range.from,
    range.to,
    assignee === "" ? undefined : Number(assignee),
  );
  const stats = useWholesaleStats(range.from, range.to);
  const rows = customers.data?.items ?? [];
  const total = customers.data?.total ?? 0;
  const s = stats.data;

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const all = rows.length > 0 && rows.every((r) => prev.has(r.id));
      const next = new Set(prev);
      for (const r of rows) {
        if (all) next.delete(r.id);
        else next.add(r.id);
      }
      return next;
    });
  }

  // No confirm dialog, like retail — reassigning isn't destructive.
  function assignSelected(assignedAdminId: number | null) {
    setAssignError(null);
    bulkAssign.mutate(
      { customerIds: [...selected], assignedAdminId },
      {
        onSuccess: () => setSelected(new Set()),
        onError: (e: unknown) =>
          setAssignError(e instanceof Error ? e.message : "Couldn't assign"),
      },
    );
  }

  function removeCustomer(customer: WholesaleCustomer) {
    setCustomerToDelete(customer);
  }

  function confirmCustomerDelete() {
    if (!customerToDelete) return;
    setDeleteError(null);
    deleteCustomer.mutate(customerToDelete.id, {
      onSuccess: () => {
        setCustomerToDelete(null);
        setDetail(null);
      },
      onError: (error: unknown) => {
        setCustomerToDelete(null);
        setDeleteError(
          error instanceof Error
            ? error.message
            : "Could not delete the customer",
        );
      },
    });
  }

  const deleteDialog = (
    <ConfirmDialog
      open={customerToDelete !== null}
      onClose={() => setCustomerToDelete(null)}
      onConfirm={confirmCustomerDelete}
      title="Delete this customer?"
      description={`${customerToDelete?.name ?? "This customer"} will move to Deleted Customers. Their order and accounting history will stay intact, and you can restore them later. Customers with live orders cannot be deleted.`}
      confirmLabel="Delete Customer"
      cancelLabel="Keep Customer"
      pendingLabel="Deleting…"
      pending={deleteCustomer.isPending}
    />
  );

  if (showDeleted) {
    return <DeletedWholesaleCustomers onBack={() => setShowDeleted(false)} />;
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Customers"
          value={String(s?.customerCount ?? 0)}
          footer="Registered wholesale buyers"
          icon={<Icon name="store" size={24} className="text-brand-500" />}
        />
        <StatCard
          label="Wholesale Customers"
          value={String(s?.wholesaleCustomerCount ?? 0)}
          footer="With wholesale history"
          icon={
            <Icon name="local_shipping" size={24} className="text-blue-500" />
          }
        />
        <StatCard
          label="Channel Customers"
          value={String(s?.channelCustomerCount ?? 0)}
          footer="With Cash Sale / Daraz / other channel orders"
          icon={<Icon name="storefront" size={24} className="text-amber-500" />}
        />
        <StatCard
          label="Total Customer Sales"
          value={compactMoney(s?.salesTotal ?? 0)}
          footer={`${compactMoney(s?.dueTotal ?? 0)} still outstanding`}
          icon={<Icon name="payments" size={24} className="text-emerald-500" />}
        />
      </div>

      <Card className="space-y-4 p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-56 flex-1">
            <input
              className={`${INPUT} w-full pl-9`}
              placeholder="Search customer by name, phone, address…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                // A narrower search is a different list; page 3 of the old
                // one is usually past the end of the new one.
                setPage(1);
              }}
            />
            <Icon
              name="search"
              size={18}
              className="pointer-events-none absolute left-3 top-2.5 text-muted"
            />
          </div>
          <select
            className={INPUT}
            value={assignee}
            onChange={(e) => {
              setAssignee(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by assigned staff"
          >
            <option value="">Assigned To: Anyone</option>
            <option value="0">Unassigned</option>
            {(staff.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            className={INPUT}
            value={dateRange}
            onChange={(e) => {
              setDateRange(e.target.value);
              setPage(1);
            }}
            aria-label="Customer order date range"
          >
            {DATE_RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          {dateRange === "custom" && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="datetime-local"
                aria-label="Customer order date from"
                className={INPUT}
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
              />
              <span className="text-xs font-semibold text-muted">to</span>
              <input
                type="datetime-local"
                aria-label="Customer order date to"
                className={INPUT}
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          )}
          <div className="flex flex-wrap gap-2.5">
            <Button
              variant="ghost"
              disabled={exporting}
              onClick={async () => {
                setExportError(null);
                setExporting(true);
                try {
                  await downloadWholesaleCustomersCsv(
                    search,
                    range.from,
                    range.to,
                    assignee === "" ? undefined : Number(assignee),
                  );
                } catch (e) {
                  setExportError(
                    e instanceof Error ? e.message : "Couldn't export",
                  );
                } finally {
                  setExporting(false);
                }
              }}
            >
              <Icon name="download" size={18} />
              {exporting ? "Exporting…" : "Export"}
            </Button>
            <Button variant="ghost" onClick={() => setImportOpen(true)}>
              <Icon name="upload" size={18} />
              Import
            </Button>
            <Button variant="ghost" onClick={() => setShowDeleted(true)}>
              <Icon name="delete" size={18} />
              Deleted Customers
            </Button>
            <Button variant="primary" onClick={onNewCustomer}>
              <Icon name="person_add" size={18} />
              Create New Customer
            </Button>
          </div>
        </div>

        {exportError && (
          <p className="rounded-lg bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
            {exportError}
          </p>
        )}

        {deleteError && (
          <p className="rounded-lg bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
            {deleteError}
          </p>
        )}

        {customers.isLoading ? (
          <p className="py-10 text-center text-sm text-muted">
            Loading customers…
          </p>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            No customer matches that.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-border px-4 py-3">
              <span className="text-xs font-semibold text-muted">
                {selected.size > 0
                  ? `${selected.size} selected`
                  : "Select customers to act on"}
              </span>
              <select
                aria-label="Bulk assign to staff"
                disabled={selected.size === 0 || bulkAssign.isPending || !canAssign}
                title={canAssign ? undefined : "You do not have permission to reassign customers"}
                value=""
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) assignSelected(v === "unassign" ? null : Number(v));
                }}
                className={`${INPUT} h-9 text-xs font-semibold disabled:opacity-40`}
              >
                <option value="" disabled>
                  {bulkAssign.isPending ? "Assigning…" : "Assign to…"}
                </option>
                <option value="unassign">— (Unassign)</option>
                {(staff.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {selected.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="text-xs font-semibold text-muted hover:text-text"
                >
                  Clear
                </button>
              )}
              <span className="ml-auto text-xs font-semibold text-muted">
                {total} customers
              </span>
            </div>
            {assignError && (
              <p className="rounded-lg bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
                {assignError}
              </p>
            )}
            <WholesaleCustomersTable
              customers={rows}
              staff={staff.data}
              selected={selected}
              onToggle={toggleOne}
              onToggleAll={toggleAll}
              onView={setDetail}
              onOrder={onOrderFor}
              onEdit={onEditCustomer}
              onDelete={canDelete ? removeCustomer : undefined}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Pager
                  page={page}
                  pageSize={pageSize}
                  total={total}
                  onPage={setPage}
                  noun="customers"
                />
              </div>
              <select
                aria-label="Customers per page"
                className="h-9 rounded-lg border border-border bg-surface px-2 text-xs font-semibold text-secondary outline-none"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                {[6, 10, 25, 50].map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </Card>

      {importOpen && (
        <CustomerImportModal
          title="Import Wholesale Customers"
          endpoint="/api/backend/admin/wholesale/customers/import"
          queryKey={["admin-wholesale-customers"]}
          onClose={() => setImportOpen(false)}
        />
      )}
      {detail && (
        <WholesaleCustomerDetailModal
          // Re-read from the refetched page so an edit made from this modal
          // shows up in it, instead of the snapshot taken when it opened.
          customer={rows.find((r) => r.id === detail.id) ?? detail}
          onClose={() => setDetail(null)}
          onEdit={() => onEditCustomer(detail)}
          onOrder={() => onOrderFor(detail)}
          onDelete={() => removeCustomer(detail)}
          canDelete={canDelete}
          deleting={deleteCustomer.isPending}
          deleteError={deleteError}
        />
      )}
      {deleteDialog}
    </div>
  );
}
