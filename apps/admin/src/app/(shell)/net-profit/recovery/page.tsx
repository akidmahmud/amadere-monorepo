"use client";

import { useRef, useState } from "react";
import { Button, Card, Icon, Modal, PageHeader, Table, TableEmptyRow, Tabs } from "@amader/admin-ui";
import {
  useClearAllIncomplete,
  useCreateOrderFromIncomplete,
  useDeleteIncompleteOrder,
  useImportRecoveryCsv,
  useIncompleteOrders,
  useRecoveryRate,
  useRecoverySettings,
  useSendRecovery,
  useUpdateRecoverySettings,
  recoveryExportUrl,
  type CreateOrderInput,
  type IncompleteOrder,
  type RecoveryFilters,
} from "@/hooks/useRecovery";
import {
  MERGE_TAGS,
  useCampaignLogs,
  useCampaignQueue,
  useCampaignSettings,
  useCampaignTemplates,
  useCancelCampaignQueueItem,
  useCreateCampaignTemplate,
  useRetryCampaignQueueItem,
  useUpdateCampaignSettings,
  useUpdateCampaignTemplate,
  type CampaignChannel,
  type DelayUnit,
} from "@/hooks/useCartCampaigns";

const cartIcon = <Icon name="shopping_cart" />;

function CreateOrderModal({ row, onClose }: { row: IncompleteOrder; onClose: () => void }) {
  const createOrder = useCreateOrderFromIncomplete();
  const [form, setForm] = useState<CreateOrderInput>({
    recipientName: "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    division: "",
    district: "",
    area: "",
    landmark: "",
    addressLine: "",
    postCode: "",
  });

  return (
    <Modal open onClose={onClose} title="Create order from abandoned cart" tone="dark">
      <div className="mb-4 flex flex-col gap-1.5 rounded-inner bg-surface-2 p-3">
        <p className="text-xs font-semibold text-secondary">Cart contents</p>
        {row.cart.map((item) => (
          <p key={item.productId} className="text-xs text-text">
            {item.quantity} × {item.name} — ৳{item.unitPrice}
          </p>
        ))}
        <p className="text-xs font-semibold text-text">Subtotal: ৳{Number(row.subtotal).toLocaleString()}</p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          createOrder.mutate(
            { id: row.id, ...form },
            {
              onSuccess: (r) => {
                alert(`Order ${r.orderNumber} created.`);
                onClose();
              },
            },
          );
        }}
        className="grid grid-cols-2 gap-3"
      >
        <input
          placeholder="Recipient name *"
          required
          value={form.recipientName}
          onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
          className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        />
        <input
          placeholder="Phone *"
          required
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        />
        <input
          placeholder="Email (optional)"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="col-span-2 h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        />
        <input
          placeholder="Division *"
          required
          value={form.division}
          onChange={(e) => setForm({ ...form, division: e.target.value })}
          className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        />
        <input
          placeholder="District *"
          required
          value={form.district}
          onChange={(e) => setForm({ ...form, district: e.target.value })}
          className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        />
        <input
          placeholder="Area (optional)"
          value={form.area}
          onChange={(e) => setForm({ ...form, area: e.target.value })}
          className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        />
        <input
          placeholder="Landmark (optional)"
          value={form.landmark}
          onChange={(e) => setForm({ ...form, landmark: e.target.value })}
          className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        />
        <input
          placeholder="Address line *"
          required
          value={form.addressLine}
          onChange={(e) => setForm({ ...form, addressLine: e.target.value })}
          className="col-span-2 h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        />
        <input
          placeholder="Postcode (optional)"
          value={form.postCode}
          onChange={(e) => setForm({ ...form, postCode: e.target.value })}
          className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        />
        {createOrder.isError && (
          <p className="col-span-2 text-xs text-danger">
            {createOrder.error instanceof Error ? createOrder.error.message : "Couldn't create the order"}
          </p>
        )}
        <Button type="submit" variant="primary" className="col-span-2" disabled={createOrder.isPending}>
          {createOrder.isPending ? "Creating…" : "Create order"}
        </Button>
      </form>
    </Modal>
  );
}

function FunnelTab() {
  const { data: rate } = useRecoveryRate();
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [recovered, setRecovered] = useState<string>("");
  const filters: RecoveryFilters = {
    q: q || undefined,
    from: from || undefined,
    to: to || undefined,
    recovered: recovered === "" ? undefined : recovered === "true",
  };
  const { data, isLoading } = useIncompleteOrders(filters);
  const send = useSendRecovery();
  const del = useDeleteIncompleteOrder();
  const clearAll = useClearAllIncomplete();
  const importCsv = useImportRecoveryCsv();
  const fileRef = useRef<HTMLInputElement>(null);
  const [orderRow, setOrderRow] = useState<IncompleteOrder | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="flex flex-col items-center gap-1 py-4">
          <span className="text-2xl font-semibold text-text">{rate?.total ?? 0}</span>
          <span className="text-xs text-muted">Abandoned carts</span>
        </Card>
        <Card className="flex flex-col items-center gap-1 py-4">
          <span className="text-2xl font-semibold text-success">{rate?.ratePercent ?? 0}%</span>
          <span className="text-xs text-muted">Recovery rate</span>
        </Card>
        <Card className="flex flex-col items-center gap-1 py-4">
          <span className="text-2xl font-semibold text-success">৳{Number(rate?.recoveredValue ?? 0).toLocaleString()}</span>
          <span className="text-xs text-muted">Recovered value</span>
        </Card>
      </div>

      <Card className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Search</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Phone, email, name…"
            className="h-10 w-52 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Status</span>
          <select
            value={recovered}
            onChange={(e) => setRecovered(e.target.value)}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          >
            <option value="">All</option>
            <option value="false">Not recovered</option>
            <option value="true">Recovered</option>
          </select>
        </label>
      </Card>

      <div className="flex flex-wrap gap-2.5">
        <a href={recoveryExportUrl(filters)} className="inline-flex">
          <Button type="button" variant="ghost">
            Export CSV
          </Button>
        </a>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) importCsv.mutate(file, { onSuccess: (r) => alert(`Imported ${r.imported}, skipped ${r.skipped}`) });
            e.target.value = "";
          }}
        />
        <Button type="button" variant="ghost" onClick={() => fileRef.current?.click()} disabled={importCsv.isPending}>
          {importCsv.isPending ? "Importing…" : "Import CSV"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={clearAll.isPending}
          onClick={() => {
            if (confirm("Delete all non-recovered abandoned-cart rows matching the current filters?")) {
              clearAll.mutate(filters.recovered);
            }
          }}
        >
          Clear all (not recovered)
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}

      <Card className="overflow-hidden p-0">
        <Table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Cart</th>
              <th>Stage</th>
              <th>Subtotal</th>
              <th>Last seen</th>
              <th>Attempts</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data && data.items.length === 0 && <TableEmptyRow colSpan={7}>No abandoned carts captured yet.</TableEmptyRow>}
            {data?.items.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className="flex flex-col gap-0.5">
                    <span className="num text-sm font-semibold text-text">{row.phone ?? "no phone (guest)"}</span>
                    {row.email && <span className="text-xs text-secondary">{row.email}</span>}
                  </div>
                </td>
                <td>
                  {row.cart.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {row.cart.map((item) => (
                        <div key={item.productId} className="flex items-center gap-1.5" title={item.name}>
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.imageUrl} alt={item.name} className="h-8 w-8 rounded-inner border border-border object-cover" />
                          ) : (
                            <span className="grid h-8 w-8 place-items-center rounded-inner bg-surface-2 text-[10px] text-muted">—</span>
                          )}
                          <span className="text-xs text-secondary">×{item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </td>
                <td>
                  <span className="rounded-pill bg-surface-2 px-2.5 py-1 text-xs font-semibold text-secondary">{row.stage}</span>
                </td>
                <td className="font-semibold text-text">৳{Number(row.subtotal).toLocaleString()}</td>
                <td className="text-muted">{new Date(row.lastSeenAt).toLocaleString()}</td>
                <td className="text-muted">{row.recoveryAttempts}</td>
                <td className="text-right">
                  {row.recovered ? (
                    <span className="rounded-pill bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                      Recovered (order #{row.recoveredOrderId})
                    </span>
                  ) : (
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="ghost" disabled={send.isPending || !row.phone} onClick={() => send.mutate(row.id)}>
                        Send SMS
                      </Button>
                      <Button type="button" variant="primary" onClick={() => setOrderRow(row)}>
                        Create order
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={del.isPending}
                        onClick={() => confirm("Delete this abandoned-cart row?") && del.mutate(row.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {orderRow && <CreateOrderModal row={orderRow} onClose={() => setOrderRow(null)} />}
    </div>
  );
}

function SettingsTab() {
  const { data, isLoading } = useRecoverySettings();
  const update = useUpdateRecoverySettings();

  if (isLoading || !data) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <Card className="flex flex-col gap-4">
      <label className="flex items-center gap-2.5">
        <input type="checkbox" checked={data.enabled} onChange={(e) => update.mutate({ enabled: e.target.checked })} />
        <span className="text-sm font-semibold text-text">Enable automatic recovery sweep (hourly)</span>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Delay before sending (hours)</span>
          <input
            type="number"
            min={1}
            defaultValue={data.delayHours}
            onBlur={(e) => update.mutate({ delayHours: Number(e.target.value) })}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Max attempts</span>
          <input
            type="number"
            min={1}
            defaultValue={data.maxAttempts}
            onBlur={(e) => update.mutate({ maxAttempts: Number(e.target.value) })}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Quiet hours start (0-23)</span>
          <input
            type="number"
            min={0}
            max={23}
            defaultValue={data.quietHoursStart}
            onBlur={(e) => update.mutate({ quietHoursStart: Number(e.target.value) })}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Quiet hours end (0-23)</span>
          <input
            type="number"
            min={0}
            max={23}
            defaultValue={data.quietHoursEnd}
            onBlur={(e) => update.mutate({ quietHoursEnd: Number(e.target.value) })}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
      </div>
    </Card>
  );
}

function CampaignsTab() {
  const { data: templates, isLoading } = useCampaignTemplates();
  const create = useCreateCampaignTemplate();
  const update = useUpdateCampaignTemplate();
  const { data: settings } = useCampaignSettings();
  const updateSettings = useUpdateCampaignSettings();

  const [name, setName] = useState("");
  const [channel, setChannel] = useState<CampaignChannel>("SMS");
  const [bodyEn, setBodyEn] = useState("");
  const [bodyBn, setBodyBn] = useState("");
  const [delayValue, setDelayValue] = useState(60);
  const [delayUnit, setDelayUnit] = useState<DelayUnit>("MINUTE");

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={settings?.enabled ?? false}
          onChange={(e) => updateSettings.mutate({ enabled: e.target.checked })}
        />
        <span className="text-sm font-semibold text-text">Enable the automated campaign worker (every 5 minutes)</span>
      </Card>

      <Card className="flex flex-col gap-3">
        <p className="text-xs font-semibold text-secondary">Merge tags — usable in any template body</p>
        <div className="flex flex-wrap gap-2">
          {MERGE_TAGS.map((t) => (
            <span key={t.token} className="num rounded-pill bg-surface-2 px-2.5 py-1 text-[11px] text-secondary" title={t.label}>
              {`{{${t.token}}}`}
            </span>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <p className="text-xs font-semibold text-secondary">New template</p>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="h-10 w-48 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Channel</span>
            <select value={channel} onChange={(e) => setChannel(e.target.value as CampaignChannel)} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500">
              <option value="SMS">SMS</option>
              <option value="EMAIL">EMAIL</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Delay</span>
            <div className="flex gap-1.5">
              <input type="number" min={1} value={delayValue} onChange={(e) => setDelayValue(Number(e.target.value))} className="h-10 w-20 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
              <select value={delayUnit} onChange={(e) => setDelayUnit(e.target.value as DelayUnit)} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500">
                <option value="MINUTE">minutes</option>
                <option value="HOUR">hours</option>
                <option value="DAY">days</option>
              </select>
            </div>
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Body (English)</span>
          <textarea value={bodyEn} onChange={(e) => setBodyEn(e.target.value)} rows={2} className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand-500" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Body (বাংলা)</span>
          <textarea value={bodyBn} onChange={(e) => setBodyBn(e.target.value)} rows={2} className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand-500" />
        </label>
        <Button
          type="button"
          variant="primary"
          className="self-start"
          disabled={create.isPending || !name.trim() || !bodyEn.trim()}
          onClick={() =>
            create.mutate(
              { name, channel, subject: null, bodyEn, bodyBn, delayValue, delayUnit },
              { onSuccess: () => { setName(""); setBodyEn(""); setBodyBn(""); } },
            )
          }
        >
          {create.isPending ? "Adding…" : "Add template"}
        </Button>
      </Card>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      <div className="flex flex-col gap-2">
        {templates?.map((t) => (
          <Card key={t.id} className="flex items-center gap-3">
            <span className="rounded-pill bg-surface-2 px-2.5 py-1 text-xs font-semibold text-secondary">{t.channel}</span>
            <span className="text-sm font-semibold text-text">{t.name}</span>
            <span className="text-xs text-muted">
              +{t.delayValue} {t.delayUnit.toLowerCase()}
            </span>
            <label className="ml-auto flex items-center gap-1.5 text-xs text-secondary">
              <input
                type="checkbox"
                checked={t.status === "ACTIVE"}
                onChange={(e) => update.mutate({ id: t.id, status: e.target.checked ? "ACTIVE" : "PAUSED" })}
              />
              Active
            </label>
          </Card>
        ))}
      </div>
    </div>
  );
}

function QueueTab() {
  const { data: queue, isLoading } = useCampaignQueue();
  const { data: logs } = useCampaignLogs();
  const retry = useRetryCampaignQueueItem();
  const cancel = useCancelCampaignQueueItem();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-xs font-semibold text-secondary">Queue</p>
        {isLoading && <p className="text-sm text-muted">Loading…</p>}
        {queue && queue.length === 0 && <p className="text-sm text-muted">No campaign steps queued yet.</p>}
        <div className="flex flex-col gap-2">
          {queue?.map((q) => (
            <Card key={q.id} className="flex items-center gap-3">
              <span className="rounded-pill bg-surface-2 px-2.5 py-1 text-xs font-semibold text-secondary">{q.channel}</span>
              <span className="num text-sm text-text">{q.recipient ?? "—"}</span>
              <span
                className={`rounded-pill px-2.5 py-1 text-xs font-semibold ${
                  q.status === "SENT" ? "bg-success/10 text-success" : q.status === "FAILED" ? "bg-danger/10 text-danger" : q.status === "SKIPPED" ? "bg-border text-secondary" : "bg-warning/10 text-warning"
                }`}
              >
                {q.status}
              </span>
              <span className="text-xs text-muted">{new Date(q.scheduledAt).toLocaleString()}</span>
              {(q.status === "PENDING" || q.status === "FAILED") && (
                <div className="ml-auto flex gap-2">
                  <Button type="button" variant="ghost" disabled={retry.isPending} onClick={() => retry.mutate(q.id)}>
                    Send now
                  </Button>
                  <Button type="button" variant="ghost" disabled={cancel.isPending} onClick={() => cancel.mutate(q.id)}>
                    Cancel
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-secondary">Log</p>
        <div className="flex flex-col gap-2">
          {logs?.map((l) => (
            <Card key={l.id} className="flex items-center gap-3">
              <span className="num text-sm text-text">{l.recipient ?? "—"}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-secondary">{l.message}</span>
              <span
                className={`rounded-pill px-2.5 py-1 text-xs font-semibold ${l.status === "SENT" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}
              >
                {l.status}
              </span>
              <span className="text-xs text-muted">{new Date(l.sentAt).toLocaleString()}</span>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function RecoveryPage() {
  const [tab, setTab] = useState("funnel");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader icon={cartIcon} title="Recovery & Cart Abandonment" subtitle="Abandoned-cart funnel, automated win-back campaigns, and manual recovery." />
      <Tabs
        variant="pill"
        options={[
          { value: "funnel", label: "Funnel" },
          { value: "campaigns", label: "Campaigns" },
          { value: "queue", label: "Queue & Log" },
          { value: "settings", label: "Settings" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "funnel" && <FunnelTab />}
      {tab === "campaigns" && <CampaignsTab />}
      {tab === "queue" && <QueueTab />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}
