"use client";

import { useState } from "react";
import { Card } from "@amader/admin-ui";
import { useAuditLog } from "@/hooks/useAuditLog";

export default function AuditLogPage() {
  const [entityType, setEntityType] = useState("");
  const { data, isLoading } = useAuditLog({ entityType: entityType || undefined });

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary">{data?.total ?? 0} entries</p>
        <input
          placeholder="Filter by entity type (e.g. AdminHomepageSections)"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className="h-10 w-80 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        />
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}

      <div className="flex flex-col gap-2">
        {data?.items.map((entry) => (
          <Card key={entry.id} className="flex items-center justify-between py-3">
            <div className="text-sm text-text">
              <span className="font-semibold">Admin #{entry.adminUserId}</span>{" "}
              <span className="num">{entry.action}</span>
              {entry.entityLabel && <span className="text-muted"> — {entry.entityLabel}</span>}
            </div>
            <div className="text-xs text-muted">{new Date(entry.createdAt).toLocaleString()}</div>
          </Card>
        ))}
      </div>
    </>
  );
}
