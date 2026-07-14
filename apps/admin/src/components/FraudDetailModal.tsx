"use client";

import { Button, Modal, RiskBadge } from "@amader/admin-ui";
import type { RiskLevel as RiskBadgeLevel } from "@amader/admin-ui";
import { useFraudCheck, useRecheckFraud } from "@/hooks/useFraud";

// Shared by the Fraud Checker board and the Order Manager's RiskBadge
// click-through (ADDENDUM Fraud Detection parity — the badge used to be
// inert with no percent/courier detail visible from Order Manager).
export function FraudDetailModal({ phone, onClose }: { phone: string; onClose: () => void }) {
  const { data: check, isLoading, isError } = useFraudCheck(phone);
  const recheck = useRecheckFraud();

  return (
    <Modal open onClose={onClose} title={phone} tone="dark">
      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {isError && (
        <p className="text-sm text-muted">
          No courier delivery data available — Fraud Checker may be disabled, or this phone has no history yet.
        </p>
      )}
      {check && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <RiskBadge level={check.riskLevel as RiskBadgeLevel} />
            <span className="text-sm text-secondary">
              {check.successRate !== null ? `${Math.round(check.successRate * 100)}% success rate` : "Not enough data"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-inner bg-surface-2 p-3 text-center">
              <div className="text-lg font-semibold text-text">{check.totalOrders}</div>
              <div className="text-xs text-muted">Total orders</div>
            </div>
            <div className="rounded-inner bg-surface-2 p-3 text-center">
              <div className="text-lg font-semibold text-success">{check.delivered}</div>
              <div className="text-xs text-muted">Delivered</div>
            </div>
            <div className="rounded-inner bg-surface-2 p-3 text-center">
              <div className="text-lg font-semibold text-danger">{check.cancelled}</div>
              <div className="text-xs text-muted">Cancelled/returned</div>
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-secondary">Per-courier breakdown</p>
            <pre className="overflow-x-auto rounded-inner bg-surface-2 p-3 text-xs text-secondary">
              {JSON.stringify(check.breakdown, null, 2)}
            </pre>
          </div>
          <p className="text-xs text-muted">
            Checked {new Date(check.checkedAt).toLocaleString()} · source: {check.source} · expires{" "}
            {new Date(check.expiresAt).toLocaleString()}
          </p>
          <Button
            type="button"
            variant="primary"
            onClick={() => recheck.mutate(phone)}
            disabled={recheck.isPending}
            className="self-start"
          >
            {recheck.isPending ? "Rechecking…" : "Re-check now"}
          </Button>
        </div>
      )}
    </Modal>
  );
}
