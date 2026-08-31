"use client";

import { useState } from "react";
import { Button, Card, Icon } from "@amader/admin-ui";
import { EditableReasonCell } from "@/components/net-profit/EditableReasonCell";
import {
  useDeletedCarts,
  useRestoreIncompleteOrder,
} from "@/hooks/useRecovery";

const PAGE_SIZE = 20;

const money = (v: string | number) =>
  `৳${Number(v).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;

export function TrashSection() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const { data, isLoading, error } = useDeletedCarts(page, PAGE_SIZE, q);
  const restore = useRestoreIncompleteOrder();
  const [failure, setFailure] = useState<string | null>(null);

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-text">Deleted Carts</h3>
            <p className="text-xs text-secondary">
              Restorable for 30 days. After that they are permanently removed by
              the nightly cleanup.
            </p>
          </div>
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search name, phone, email or reason…"
            className="h-10 w-72 rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        {failure && <p className="text-xs text-danger">{failure}</p>}
        {error instanceof Error && (
          <p className="text-xs text-danger">{error.message}</p>
        )}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-surface-2 text-xs text-secondary">
              <tr>
                {[
                  "Customer",
                  "Stage",
                  "Subtotal",
                  "Reason",
                  "Deleted",
                  "Auto-removes in",
                  "",
                ].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-xs text-secondary"
                  >
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-xs text-secondary"
                  >
                    Nothing in the trash.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-text">
                      {row.name ?? "Guest"}
                    </div>
                    <div className="text-xs text-secondary">
                      {row.phone ?? row.email ?? "No contact details"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs uppercase text-secondary">
                    {row.stage}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {money(row.subtotal)}
                  </td>
                  <td className="px-4 py-3">
                    <EditableReasonCell
                      id={row.id}
                      reason={row.cancelReason}
                      placeholder="Why was this binned?"
                    />
                  </td>
                  <td className="px-4 py-3 text-xs text-secondary">
                    {row.deletedAt
                      ? new Date(row.deletedAt).toLocaleDateString("en-GB")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {/* The countdown is the point of a trash: it says how long
                        the decision stays reversible. Coloured once it is
                        nearly out of time. */}
                    <span
                      className={
                        (row.daysRemaining ?? 0) <= 7
                          ? "font-semibold text-amber-600 dark:text-amber-400"
                          : "text-secondary"
                      }
                    >
                      {row.daysRemaining ?? 0} day
                      {row.daysRemaining === 1 ? "" : "s"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      disabled={restore.isPending}
                      onClick={async () => {
                        setFailure(null);
                        try {
                          await restore.mutateAsync(row.id);
                        } catch (e) {
                          setFailure(
                            e instanceof Error
                              ? e.message
                              : "Couldn't restore that cart",
                          );
                        }
                      }}
                    >
                      <Icon name="restore_from_trash" size={16} />
                      Restore
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pageCount > 1 && (
          <div className="flex items-center justify-between text-xs text-secondary">
            <span>
              {total} deleted cart{total === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span>
                {page} / {pageCount}
              </span>
              <Button
                variant="ghost"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
