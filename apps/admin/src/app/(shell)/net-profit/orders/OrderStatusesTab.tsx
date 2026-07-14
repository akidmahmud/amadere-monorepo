"use client";

import { useState } from "react";
import { Button, Card, Table } from "@amader/admin-ui";
import { useOrderStatusConfigs, useUpdateOrderStatusConfig, type OrderStatusConfig } from "@/hooks/useOrderStatuses";

// Note on scope: these are a label/color overlay on the fixed Postgres
// `OrderStatus` enum, not real custom order statuses the way the plugin
// registers new WooCommerce statuses (which affect gateway transitions and
// reports). Intentional simplification — editing here only changes display
// label/color/order, not the underlying status set.
function StatusRow({ config }: { config: OrderStatusConfig }) {
  const update = useUpdateOrderStatusConfig();
  const [labelEn, setLabelEn] = useState(config.labelEn);
  const [labelBn, setLabelBn] = useState(config.labelBn);
  const [color, setColor] = useState(config.color);
  const [sortOrder, setSortOrder] = useState(config.sortOrder);
  const dirty = labelEn !== config.labelEn || labelBn !== config.labelBn || color !== config.color || sortOrder !== config.sortOrder;

  return (
    <tr>
      <td className="font-mono text-xs text-secondary">{config.status}</td>
      <td>
        <input value={labelEn} onChange={(e) => setLabelEn(e.target.value)} className="h-9 w-40 rounded-sm border border-border bg-surface px-2 text-sm text-text outline-none focus:border-brand-500" />
      </td>
      <td>
        <input value={labelBn} onChange={(e) => setLabelBn(e.target.value)} className="h-9 w-40 rounded-sm border border-border bg-surface px-2 text-sm text-text outline-none focus:border-brand-500" />
      </td>
      <td>
        <div className="flex items-center gap-2">
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-9 rounded-sm border border-border bg-surface" />
          <span className="font-mono text-xs text-secondary">{color}</span>
        </div>
      </td>
      <td>
        <input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className="num h-9 w-16 rounded-sm border border-border bg-surface px-2 text-sm text-text outline-none focus:border-brand-500" />
      </td>
      <td>
        <Button type="button" variant="primary" disabled={!dirty || update.isPending} onClick={() => update.mutate({ status: config.status, labelEn, labelBn, color, sortOrder })}>
          {update.isPending ? "Saving…" : "Save"}
        </Button>
      </td>
    </tr>
  );
}

export function OrderStatusesTab() {
  const { data: configs, isLoading } = useOrderStatusConfigs();
  const sorted = [...(configs ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h3 className="font-ui text-base font-semibold text-text">Order status labels</h3>
        <p className="text-xs text-muted">
          Customize the display label, color, and sort order shown across Order Manager for each status. This is a
          display overlay on the fixed order status set — it does not add new statuses.
        </p>
      </div>
      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {!isLoading && (
        <Table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Label (EN)</th>
              <th>Label (BN)</th>
              <th>Color</th>
              <th>Sort order</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((config) => <StatusRow key={config.status} config={config} />)}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
