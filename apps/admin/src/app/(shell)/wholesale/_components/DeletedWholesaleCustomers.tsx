"use client";

import { useState } from "react";
import { Button, Card, Icon } from "@amader/admin-ui";
import { useCan } from "@/hooks/useAdminAuth";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  useDeletedWholesaleCustomers,
  useRestoreWholesaleCustomer,
  type WholesaleCustomer,
} from "@/hooks/useWholesale";
import { Pager } from "./Pager";

const INPUT =
  "h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none transition-all duration-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 placeholder:text-muted";

const money = (value: string) =>
  `৳${Number(value || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export function DeletedWholesaleCustomers({ onBack }: { onBack: () => void }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [customerToRestore, setCustomerToRestore] =
    useState<WholesaleCustomer | null>(null);
  const deleted = useDeletedWholesaleCustomers(search, page, 20);
  const restore = useRestoreWholesaleCustomer();
  const canRestore = useCan("wholesale.delete");

  function restoreCustomer(customer: WholesaleCustomer) {
    setCustomerToRestore(customer);
  }

  function confirmCustomerRestore() {
    if (!customerToRestore) return;
    setError(null);
    restore.mutate(customerToRestore.id, {
      onSuccess: () => setCustomerToRestore(null),
      onError: (reason: unknown) => {
        setCustomerToRestore(null);
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not restore the customer",
        );
      },
    });
  }

  const rows = deleted.data?.items ?? [];

  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5 shadow-card">
        <div>
          <h2 className="text-base font-bold text-text">Deleted Customers</h2>
          <p className="mt-1 text-xs text-secondary">
            Soft-deleted wholesale buyers remain here with their order and
            accounting history.
          </p>
        </div>
        <Button variant="ghost" onClick={onBack}>
          <Icon name="arrow_back" size={18} />
          Back to Customers
        </Button>
      </Card>

      <Card className="space-y-4 p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-56 flex-1">
            <input
              className={`${INPUT} w-full pl-9`}
              placeholder="Search deleted customer by name, phone, address…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            <Icon
              name="search"
              size={18}
              className="pointer-events-none absolute left-3 top-2.5 text-muted"
            />
          </div>
          <span className="text-xs font-semibold text-secondary">
            {deleted.data?.total ?? 0} deleted customers
          </span>
        </div>

        {error && (
          <p className="rounded-lg bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}

        {deleted.isLoading ? (
          <p className="py-10 text-center text-sm text-muted">
            Loading deleted customers…
          </p>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            No deleted customer matches that search.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr className="bg-surface-2 text-[9px] uppercase tracking-wide text-muted">
                    <th className="px-3 py-2.5 text-left">Customer</th>
                    <th className="px-3 py-2.5 text-left">Phone</th>
                    <th className="px-3 py-2.5 text-right">Orders</th>
                    <th className="px-3 py-2.5 text-right">Purchase</th>
                    <th className="px-3 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((customer) => (
                    <tr
                      key={customer.id}
                      className="border-t border-border text-xs"
                    >
                      <td className="px-3 py-3 font-semibold text-text">
                        {customer.name}
                      </td>
                      <td className="px-3 py-3 text-secondary">
                        {customer.phone ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {customer.orderCount}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold">
                        {money(customer.purchaseTotal)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {canRestore ? (
                          <button
                            type="button"
                            disabled={restore.isPending}
                            onClick={() => restoreCustomer(customer)}
                            className="font-bold text-emerald-700 hover:underline disabled:opacity-50 dark:text-emerald-400"
                          >
                            Restore Customer
                          </button>
                        ) : (
                          <span className="text-muted">No permission</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager
              page={page}
              pageSize={20}
              total={deleted.data?.total ?? 0}
              onPage={setPage}
              noun="deleted customers"
            />
          </>
        )}
      </Card>
      <ConfirmDialog
        open={customerToRestore !== null}
        onClose={() => setCustomerToRestore(null)}
        onConfirm={confirmCustomerRestore}
        title="Restore this customer?"
        description={`${customerToRestore?.name ?? "This customer"} will become active again and available for new wholesale orders. Their existing order and accounting history remains unchanged.`}
        confirmLabel="Restore Customer"
        cancelLabel="Keep Deleted"
        pendingLabel="Restoring…"
        tone="success"
        pending={restore.isPending}
      />
    </div>
  );
}
