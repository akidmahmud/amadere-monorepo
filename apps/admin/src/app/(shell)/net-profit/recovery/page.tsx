"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  DistrictAutocomplete,
  ThanaAutocomplete,
} from "@/components/DistrictThanaFields";
import {
  OrderDetailModal,
  type OrderDetailModalRow,
} from "@/components/OrderDetailModal";
import { Button, Card, Icon, Modal } from "@amader/admin-ui";
import { RecoveryStatsStrip } from "@/components/net-profit/RecoveryStatsStrip";
import {
  RecoveryFilterBar,
  type RecoveryFilterState,
} from "@/components/net-profit/RecoveryFilterBar";
import {
  RecoveryTable,
  RECOVERY_OPTIONAL_COLUMNS,
  type RecoveryOptionalColumn,
} from "@/components/net-profit/RecoveryTable";
import { RecoveredSection } from "./_components/RecoveredSection";
import { TrashSection } from "./_components/TrashSection";
import {
  useClearAllIncomplete,
  useCreateOrderFromIncomplete,
  useDeleteIncompleteOrder,
  useImportRecoveryCsv,
  useIncompleteOrders,
  ABANDONMENT_STAGES,
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

const GREEN = "#2e7d43";
const GREEN_DARK = "#1d5230";
const LINE = "#e5ebe6";
const INK = "#1e2b22";
const MUTED = "#64766b";
const TEXT = "#374840";

const PAGE_SIZE_KEY = "wpfok-recovery-page-size";
const COLUMNS_KEY = "wpfok-recovery-columns";
const COLUMN_LABELS: Record<RecoveryOptionalColumn, string> = {
  cartDetails: "Cart Items",
  stage: "Stage",
  subtotal: "Subtotal",
  attempts: "Attempts",
  lastSeen: "Last Seen",
  cancelReason: "Cancel Reason",
};

const DEFAULT_FILTERS: RecoveryFilterState = { q: "" };

const ROLLING_WINDOW_HOURS: Record<string, number> = {
  "1h": 1,
  "6h": 6,
  "12h": 12,
  "24h": 24,
  "7d": 7 * 24,
  "30d": 30 * 24,
};

function parseCustomBound(value: string, edge: "start" | "end"): Date {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!dateOnly) return new Date(value);
  return new Date(
    edge === "start" ? `${value}T00:00:00.000` : `${value}T23:59:59.999`,
  );
}

function resolveDateRange(
  value: string | undefined,
  customFrom?: string,
  customTo?: string,
): { from?: string; to?: string } {
  if (value === "custom") {
    if (!customFrom || !customTo) return {};
    return {
      from: parseCustomBound(customFrom, "start").toISOString(),
      to: parseCustomBound(customTo, "end").toISOString(),
    };
  }
  if (!value) return {};
  const to = new Date();
  if (value === "today") {
    const from = new Date(
      to.getFullYear(),
      to.getMonth(),
      to.getDate(),
      0,
      0,
      0,
      0,
    );
    return { from: from.toISOString(), to: to.toISOString() };
  }
  const hours = ROLLING_WINDOW_HOURS[value];
  if (!hours) return {};
  const from = new Date(to.getTime() - hours * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

function HeaderButton({
  children,
  onClick,
  href,
  active,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  active?: boolean;
}) {
  const className =
    "inline-flex h-10 items-center gap-2 rounded-[10px] border px-[15px] text-[0.8rem] font-bold transition-colors duration-150 hover:bg-[#f2f6f3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2e7d43] focus-visible:ring-offset-1";
  const style = active
    ? { borderColor: GREEN, color: "#fff", background: GREEN }
    : { borderColor: LINE, color: TEXT, background: "#fff" };

  if (href) {
    return (
      <Link href={href} className={className} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className} style={style}>
      {children}
    </button>
  );
}

function ScreenOptionsModal({
  columns,
  onToggleColumn,
  pageSize,
  onPageSize,
  onClose,
}: {
  columns: Set<RecoveryOptionalColumn>;
  onToggleColumn: (c: RecoveryOptionalColumn) => void;
  pageSize: number;
  onPageSize: (n: number) => void;
  onClose: () => void;
}) {
  return (
    <Modal open onClose={onClose} title="Screen Options">
      <div className="flex flex-col gap-5">
        <div>
          <p className="mb-2 text-xs font-semibold text-secondary">Columns</p>
          <div className="flex flex-col gap-1.5">
            {RECOVERY_OPTIONAL_COLUMNS.map((col) => (
              <label
                key={col}
                className="flex items-center gap-2 text-sm text-text"
              >
                <input
                  type="checkbox"
                  checked={columns.has(col)}
                  onChange={() => onToggleColumn(col)}
                />
                {COLUMN_LABELS[col]}
              </label>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">
            Rows per page
          </span>
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="h-10 w-32 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          >
            {[20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
    </Modal>
  );
}

function CreateOrderModal({
  row,
  onClose,
  onCreated,
}: {
  row: IncompleteOrder;
  onClose: () => void;
  /** Hands the new order straight to the Order Manager modal. */
  onCreated: (order: OrderDetailModalRow) => void;
}) {
  const createOrder = useCreateOrderFromIncomplete();
  const captured = (row.address ?? {}) as Record<string, string | undefined>;
  const [form, setForm] = useState<CreateOrderInput>({
    recipientName: row.name ?? "",
    phone: row.phone ?? "",
    addressLine: captured.addressLine ?? "",
    district: captured.district ?? "",
    area: captured.area ?? "",
    landmark: captured.landmark ?? "",
    alternativePhone: captured.alternativePhone ?? "",
    email: row.email ?? "",
  });
  const field =
    "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

  return (
    <Modal
      open
      onClose={onClose}
      title="Create order from abandoned cart"
      tone="dark"
    >
      <div className="mb-4 flex flex-col gap-1.5 rounded-inner bg-surface-2 p-3">
        <p className="text-xs font-semibold text-secondary">Cart contents</p>
        {row.cart.map((item) => (
          <p key={item.productId} className="text-xs text-text">
            {item.quantity} × {item.name} — ৳{item.unitPrice}
          </p>
        ))}
        <p className="text-xs font-semibold text-text">
          Subtotal: ৳{Number(row.subtotal).toLocaleString()}
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const blank = (v?: string) => (v && v.trim() ? v.trim() : undefined);
          createOrder.mutate(
            {
              id: row.id,
              recipientName: form.recipientName.trim(),
              phone: form.phone.trim(),
              addressLine: form.addressLine.trim(),
              district: form.district,
              area: form.area.trim(),
              landmark: blank(form.landmark),
              alternativePhone: blank(form.alternativePhone),
              email: blank(form.email),
            },
            {
              onSuccess: (r) => {
                // No alert(): the order almost always needs a look straight
                // away — quantities adjusted, an item added, a status set —
                // and an OK button that dumps staff back to the funnel list
                // makes them go and find the order they just made.
                onClose();
                onCreated({
                  id: r.orderId,
                  orderNumber: r.orderNumber,
                  // Nothing is consigned yet at creation, and the phone is
                  // the one just typed into this form. Everything else the
                  // modal needs it fetches by id.
                  shipmentId: null,
                  shippingPhone: form.phone.trim() || null,
                });
              },
            },
          );
        }}
        className="grid grid-cols-2 gap-3"
      >
        <input
          placeholder="Your Full Name *"
          required
          value={form.recipientName}
          onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
          className={field}
        />
        {/* Click-to-call sits INSIDE the field rather than beside it: this
            form is two columns, and giving the phone its own button cell
            would knock every field after it out of alignment. Appears only
            once there is a number worth dialling. */}
        <div className="relative">
          <input
            placeholder="017********* *"
            required
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className={`w-full ${field} ${form.phone.trim() ? "pr-11" : ""}`}
          />
          {form.phone.trim() && (
            <a
              href={`tel:${form.phone.trim()}`}
              title={`Call ${form.phone.trim()}`}
              className="absolute right-1 top-1 inline-flex h-8 w-8 items-center justify-center rounded-sm text-brand-600 hover:bg-surface-2"
            >
              <Icon name="call" size={17} />
            </a>
          )}
        </div>
        <input
          placeholder="House no. / building / street / area *"
          required
          value={form.addressLine}
          onChange={(e) => setForm({ ...form, addressLine: e.target.value })}
          className={`col-span-2 ${field}`}
        />
        <DistrictAutocomplete
          value={form.district}
          onChange={(next) => setForm({ ...form, district: next, area: "" })}
        />
        <ThanaAutocomplete
          district={form.district}
          value={form.area}
          onChange={(next) => setForm({ ...form, area: next })}
        />
        <input
          placeholder="Landmark (optional)"
          value={form.landmark ?? ""}
          onChange={(e) => setForm({ ...form, landmark: e.target.value })}
          className={`col-span-2 ${field}`}
        />
        <div className="relative">
          <input
            placeholder="Alternative Phone (optional)"
            value={form.alternativePhone ?? ""}
            onChange={(e) =>
              setForm({ ...form, alternativePhone: e.target.value })
            }
            className={`w-full ${field} ${(form.alternativePhone ?? "").trim() ? "pr-11" : ""}`}
          />
          {(form.alternativePhone ?? "").trim() && (
            <a
              href={`tel:${(form.alternativePhone ?? "").trim()}`}
              title={`Call ${(form.alternativePhone ?? "").trim()}`}
              className="absolute right-1 top-1 inline-flex h-8 w-8 items-center justify-center rounded-sm text-brand-600 hover:bg-surface-2"
            >
              <Icon name="call" size={17} />
            </a>
          )}
        </div>
        <input
          placeholder="Recipient Email (optional)"
          value={form.email ?? ""}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className={field}
        />
        {createOrder.isError && (
          <p className="col-span-2 text-xs text-danger">
            {createOrder.error instanceof Error
              ? createOrder.error.message
              : "Couldn't create the order"}
          </p>
        )}
        <Button
          type="submit"
          variant="primary"
          className="col-span-2"
          disabled={createOrder.isPending}
        >
          {createOrder.isPending ? "Creating…" : "Create order"}
        </Button>
      </form>
    </Modal>
  );
}

function FunnelSection({
  columns,
  showScreenOptions,
  setShowScreenOptions,
  pageSize,
  setPageSize,
}: {
  columns: Set<RecoveryOptionalColumn>;
  showScreenOptions: boolean;
  setShowScreenOptions: (open: boolean) => void;
  pageSize: number;
  setPageSize: (n: number) => void;
}) {
  const { data: rate } = useRecoveryRate();
  const { data: campaignSettings } = useCampaignSettings();
  const [uiFilters, setUiFilters] =
    useState<RecoveryFilterState>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setPage(1), 350);
    return () => clearTimeout(t);
  }, [uiFilters.q]);

  const dateRange = useMemo(
    () =>
      resolveDateRange(
        uiFilters.dateRange,
        uiFilters.dateFrom,
        uiFilters.dateTo,
      ),
    [uiFilters.dateRange, uiFilters.dateFrom, uiFilters.dateTo],
  );

  const filters: RecoveryFilters = {
    q: uiFilters.q || undefined,
    ...dateRange,
    // "" means "use the API default", which is open carts only.
    outcome: (uiFilters.outcome || undefined) as RecoveryFilters["outcome"],
    stage: uiFilters.stage || undefined,
    page,
    pageSize,
  };

  const { data, isLoading } = useIncompleteOrders(filters);
  const send = useSendRecovery();
  const del = useDeleteIncompleteOrder();
  const clearAll = useClearAllIncomplete();
  const importCsv = useImportRecoveryCsv();
  const fileRef = useRef<HTMLInputElement>(null);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [orderRow, setOrderRow] = useState<IncompleteOrder | null>(null);
  const [createdOrder, setCreatedOrder] = useState<OrderDetailModalRow | null>(
    null,
  );
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

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
    setSelected((prev) =>
      prev.size === data.items.length
        ? new Set()
        : new Set(data.items.map((o) => o.id)),
    );
  }

  function handleSendSms(id: number) {
    setSendingId(id);
    send.mutate(id, {
      onSettled: () => setSendingId(null),
    });
  }

  function handleDelete(id: number) {
    // Says it is reversible, because it now is — the old wording described a
    // hard delete and made people hesitate over a one-click action.
    if (
      confirm("Move this cart to the trash? You can restore it for 30 days.")
    ) {
      setDeletingId(id);
      del.mutate({ id }, { onSettled: () => setDeletingId(null) });
    }
  }

  function handleBulkSendSms() {
    if (selected.size === 0) return;
    const targetRows = (data?.items ?? []).filter(
      (r) => selected.has(r.id) && !r.recovered && r.phone,
    );
    if (targetRows.length === 0) {
      alert("No non-recovered carts with phone numbers selected.");
      return;
    }
    if (
      confirm(`Send recovery SMS to ${targetRows.length} selected cart(s)?`)
    ) {
      targetRows.forEach((r) => send.mutate(r.id));
      setSelected(new Set());
    }
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <RecoveryStatsStrip
        total={rate?.total ?? 0}
        ratePercent={rate?.ratePercent ?? 0}
        recoveredValue={rate?.recoveredValue ?? 0}
        campaignEnabled={campaignSettings?.enabled}
      />

      <RecoveryFilterBar
        filters={uiFilters}
        onChange={(next) => {
          setUiFilters(next);
          setPage(1);
        }}
        onReset={() => {
          setUiFilters(DEFAULT_FILTERS);
          setPage(1);
        }}
      />

      {/* Action / Bulk Bar */}
      <div
        className="flex flex-wrap items-center gap-2.5 rounded-card border p-[12px_16px] shadow-[0_1px_2px_rgba(20,40,25,.05)]"
        style={{ background: "#fff", borderColor: LINE }}
      >
        <span className="text-[0.76rem] font-semibold" style={{ color: MUTED }}>
          {selected.size > 0
            ? `${selected.size} selected`
            : "Select carts to act on"}
        </span>
        <button
          type="button"
          disabled={selected.size === 0 || send.isPending}
          onClick={handleBulkSendSms}
          className="inline-flex h-[38px] items-center rounded-[9px] px-3.5 text-[0.75rem] font-bold text-white disabled:opacity-40"
          style={{ background: GREEN }}
        >
          Send Bulk SMS
        </button>
        <a href={recoveryExportUrl(filters)} className="inline-flex">
          <button
            type="button"
            className="inline-flex h-[38px] items-center rounded-[9px] border px-3.5 text-[0.75rem] font-bold"
            style={{ borderColor: LINE, color: TEXT, background: "#fff" }}
          >
            Export CSV
          </button>
        </a>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file)
              importCsv.mutate(file, {
                onSuccess: (r) =>
                  alert(`Imported ${r.imported}, skipped ${r.skipped}`),
              });
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={importCsv.isPending}
          onClick={() => fileRef.current?.click()}
          className="inline-flex h-[38px] items-center rounded-[9px] border px-3.5 text-[0.75rem] font-bold disabled:opacity-40"
          style={{ borderColor: LINE, color: TEXT, background: "#fff" }}
        >
          {importCsv.isPending ? "Importing…" : "Import CSV"}
        </button>
        <button
          type="button"
          disabled={clearAll.isPending}
          onClick={() => {
            if (
              confirm(
                "Delete all OPEN abandoned-cart rows matching current filters?\n\nRecovered and cancelled carts are kept — cancelled ones hold the reason someone recorded.",
              )
            ) {
              clearAll.mutate(undefined);
            }
          }}
          className="inline-flex h-[38px] items-center rounded-[9px] border px-3.5 text-[0.75rem] font-bold disabled:opacity-40"
          style={{
            borderColor: "#f8ccd3",
            background: "#feeaec",
            color: "#e5484d",
          }}
        >
          Clear All (Not Recovered)
        </button>
        <span
          className="ml-auto text-[0.76rem] font-semibold"
          style={{ color: MUTED }}
        >
          {data?.total ?? 0} abandoned carts
        </span>
      </div>

      <RecoveryTable
        items={data?.items ?? []}
        total={data?.total ?? 0}
        filters={{ page, pageSize }}
        onFiltersChange={(next) => {
          if (next.page !== undefined) setPage(next.page);
          if (next.pageSize !== undefined) setPageSize(next.pageSize);
        }}
        columns={columns}
        selected={selected}
        onToggle={toggle}
        onToggleAll={toggleAll}
        onSendSms={handleSendSms}
        onCreateOrder={setOrderRow}
        onDelete={handleDelete}
        sendingId={sendingId}
        deletingId={deletingId}
        isLoading={isLoading}
      />

      {orderRow && (
        <CreateOrderModal
          row={orderRow}
          onClose={() => setOrderRow(null)}
          onCreated={setCreatedOrder}
        />
      )}
      {/* The same Order Manager modal the orders list opens, on the order
          that was just created — so the next edit happens here rather than
          after hunting for it in another tab. */}
      {createdOrder && (
        <OrderDetailModal
          row={createdOrder}
          onClose={() => setCreatedOrder(null)}
        />
      )}
    </div>
  );
}

function SettingsSection() {
  const { data, isLoading } = useRecoverySettings();
  const update = useUpdateRecoverySettings();

  if (isLoading || !data) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <Card className="flex flex-col gap-4">
      <label className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={data.enabled}
          onChange={(e) => update.mutate({ enabled: e.target.checked })}
        />
        <span className="text-sm font-semibold text-text">
          Enable automatic recovery sweep (hourly)
        </span>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">
            Delay before sending (hours)
          </span>
          <input
            type="number"
            min={1}
            defaultValue={data.delayHours}
            onBlur={(e) =>
              update.mutate({ delayHours: Number(e.target.value) })
            }
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">
            Max attempts
          </span>
          <input
            type="number"
            min={1}
            defaultValue={data.maxAttempts}
            onBlur={(e) =>
              update.mutate({ maxAttempts: Number(e.target.value) })
            }
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">
            Quiet hours start (0-23)
          </span>
          <input
            type="number"
            min={0}
            max={23}
            defaultValue={data.quietHoursStart}
            onBlur={(e) =>
              update.mutate({ quietHoursStart: Number(e.target.value) })
            }
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">
            Quiet hours end (0-23)
          </span>
          <input
            type="number"
            min={0}
            max={23}
            defaultValue={data.quietHoursEnd}
            onBlur={(e) =>
              update.mutate({ quietHoursEnd: Number(e.target.value) })
            }
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
      </div>

      {/* Only the WORDING lives here. The logo, the product cards, the totals
          and the WhatsApp button are generated from real data on every send,
          so there is nothing there for staff to get out of sync. */}
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <div>
          <p className="text-sm font-bold text-text">Recovery email wording</p>
          <p className="text-xs text-secondary">
            The default for every recovery email. {"{{name}}"} and {"{{total}}"} are filled in
            automatically. Staff can still tweak the text for one send from the Send Email
            preview.
          </p>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Subject</span>
          <input
            defaultValue={data.emailSubject}
            onBlur={(e) => update.mutate({ emailSubject: e.target.value })}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Heading</span>
          <input
            defaultValue={data.emailHeading}
            onBlur={(e) => update.mutate({ emailHeading: e.target.value })}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Message</span>
          <textarea
            rows={4}
            defaultValue={data.emailMessage}
            onBlur={(e) => update.mutate({ emailMessage: e.target.value })}
            className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Order button label</span>
            <input
              defaultValue={data.emailCtaLabel}
              onBlur={(e) => update.mutate({ emailCtaLabel: e.target.value })}
              className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">WhatsApp button label</span>
            <input
              defaultValue={data.emailWhatsappLabel}
              onBlur={(e) => update.mutate({ emailWhatsappLabel: e.target.value })}
              className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            />
          </label>
        </div>
      </div>
    </Card>
  );
}

function CampaignsSection() {
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
        <span className="text-sm font-semibold text-text">
          Enable the automated campaign worker (every 5 minutes)
        </span>
      </Card>

      <Card className="flex flex-col gap-3">
        <p className="text-xs font-semibold text-secondary">
          Merge tags — usable in any template body
        </p>
        <div className="flex flex-wrap gap-2">
          {MERGE_TAGS.map((t) => (
            <span
              key={t.token}
              className="num rounded-pill bg-surface-2 px-2.5 py-1 text-[11px] text-secondary"
              title={t.label}
            >
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
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 w-48 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">
              Channel
            </span>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as CampaignChannel)}
              className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            >
              <option value="SMS">SMS</option>
              <option value="EMAIL">Email</option>
              <option value="WEB_PUSH">Web Push</option>
            </select>
            {channel === "WEB_PUSH" && (
              // Worth saying here rather than in a doc: a push template only
              // reaches carts belonging to a logged-in customer who granted
              // permission, which is a much smaller set than SMS reaches.
              <span className="text-[0.68rem] text-muted">
                Reaches signed-in customers who allowed notifications. The
                subject line becomes the notification title.
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Delay</span>
            <div className="flex gap-1.5">
              <input
                type="number"
                min={1}
                value={delayValue}
                onChange={(e) => setDelayValue(Number(e.target.value))}
                className="h-10 w-20 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
              />
              <select
                value={delayUnit}
                onChange={(e) => setDelayUnit(e.target.value as DelayUnit)}
                className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
              >
                <option value="MINUTE">minutes</option>
                <option value="HOUR">hours</option>
                <option value="DAY">days</option>
              </select>
            </div>
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">
            Body (English)
          </span>
          <textarea
            value={bodyEn}
            onChange={(e) => setBodyEn(e.target.value)}
            rows={2}
            className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">
            Body (বাংলা)
          </span>
          <textarea
            value={bodyBn}
            onChange={(e) => setBodyBn(e.target.value)}
            rows={2}
            className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
        <Button
          type="button"
          variant="primary"
          className="self-start"
          disabled={create.isPending || !name.trim() || !bodyEn.trim()}
          onClick={() =>
            create.mutate(
              {
                name,
                channel,
                subject: null,
                bodyEn,
                bodyBn,
                delayValue,
                delayUnit,
              },
              {
                onSuccess: () => {
                  setName("");
                  setBodyEn("");
                  setBodyBn("");
                },
              },
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
            <span className="rounded-pill bg-surface-2 px-2.5 py-1 text-xs font-semibold text-secondary">
              {t.channel}
            </span>
            <span className="text-sm font-semibold text-text">{t.name}</span>
            <span className="text-xs text-muted">
              +{t.delayValue} {t.delayUnit.toLowerCase()}
            </span>
            <label className="ml-auto flex items-center gap-1.5 text-xs text-secondary">
              <input
                type="checkbox"
                checked={t.status === "ACTIVE"}
                onChange={(e) =>
                  update.mutate({
                    id: t.id,
                    status: e.target.checked ? "ACTIVE" : "PAUSED",
                  })
                }
              />
              Active
            </label>
          </Card>
        ))}
      </div>
    </div>
  );
}

function QueueSection() {
  const { data: queue, isLoading } = useCampaignQueue();
  const { data: logs } = useCampaignLogs();
  const retry = useRetryCampaignQueueItem();
  const cancel = useCancelCampaignQueueItem();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-xs font-semibold text-secondary">Queue</p>
        {isLoading && <p className="text-sm text-muted">Loading…</p>}
        {queue && queue.length === 0 && (
          <p className="text-sm text-muted">No campaign steps queued yet.</p>
        )}
        <div className="flex flex-col gap-2">
          {queue?.map((q) => (
            <Card key={q.id} className="flex items-center gap-3">
              <span className="rounded-pill bg-surface-2 px-2.5 py-1 text-xs font-semibold text-secondary">
                {q.channel}
              </span>
              <span className="num text-sm text-text">
                {q.recipient ?? "—"}
              </span>
              <span
                className={`rounded-pill px-2.5 py-1 text-xs font-semibold ${
                  q.status === "SENT"
                    ? "bg-success/10 text-success"
                    : q.status === "FAILED"
                      ? "bg-danger/10 text-danger"
                      : q.status === "SKIPPED"
                        ? "bg-border text-secondary"
                        : "bg-warning/10 text-warning"
                }`}
              >
                {q.status}
              </span>
              <span className="text-xs text-muted">
                {new Date(q.scheduledAt).toLocaleString()}
              </span>
              {(q.status === "PENDING" || q.status === "FAILED") && (
                <div className="ml-auto flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={retry.isPending}
                    onClick={() => retry.mutate(q.id)}
                  >
                    Send now
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={cancel.isPending}
                    onClick={() => cancel.mutate(q.id)}
                  >
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
              <span className="num text-sm text-text">
                {l.recipient ?? "—"}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-secondary">
                {l.message}
              </span>
              <span
                className={`rounded-pill px-2.5 py-1 text-xs font-semibold ${l.status === "SENT" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}
              >
                {l.status}
              </span>
              <span className="text-xs text-muted">
                {new Date(l.sentAt).toLocaleString()}
              </span>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function RecoveryPage() {
  const [section, setSection] = useState<
    "funnel" | "recovered" | "campaigns" | "queue" | "trash" | "settings"
  >("funnel");
  const [pageSize, setPageSizeState] = useState(20);
  const [columns, setColumns] = useState<Set<RecoveryOptionalColumn>>(
    new Set(RECOVERY_OPTIONAL_COLUMNS),
  );
  const [showScreenOptions, setShowScreenOptions] = useState(false);

  useEffect(() => {
    const savedSize = Number(localStorage.getItem(PAGE_SIZE_KEY));
    if (savedSize) setPageSizeState(savedSize);
    const savedCols = localStorage.getItem(COLUMNS_KEY);
    if (savedCols) {
      try {
        setColumns(new Set(JSON.parse(savedCols) as RecoveryOptionalColumn[]));
      } catch {
        /* ignore malformed value */
      }
    }
  }, []);

  function toggleColumn(col: RecoveryOptionalColumn) {
    setColumns((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      localStorage.setItem(COLUMNS_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  function setPageSize(n: number) {
    localStorage.setItem(PAGE_SIZE_KEY, String(n));
    setPageSizeState(n);
  }

  return (
    <div className="flex flex-col gap-[18px]">
      {/* Top Header matching Order Manager */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1
            className="text-[1.45rem] font-extrabold tracking-tight"
            style={{ color: INK }}
          >
            Recovery Manager
          </h1>
          <div
            className="mt-1.5 flex items-center gap-1.5 text-[0.76rem] font-semibold"
            style={{ color: MUTED }}
          >
            Dashboard <span style={{ color: "#94a69a" }}>›</span> Net Profit{" "}
            <span style={{ color: "#94a69a" }}>›</span>{" "}
            <span style={{ color: GREEN }}>Recovery</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <HeaderButton
            active={section === "funnel"}
            onClick={() => setSection("funnel")}
          >
            Funnel
          </HeaderButton>
          {/* Straight after Funnel on purpose: the two are the same list split
              by outcome — what is still to chase, and what came back. */}
          <HeaderButton
            active={section === "recovered"}
            onClick={() => setSection("recovered")}
          >
            Recovered
          </HeaderButton>
          <HeaderButton
            active={section === "campaigns"}
            onClick={() => setSection("campaigns")}
          >
            Campaigns
          </HeaderButton>
          <HeaderButton
            active={section === "queue"}
            onClick={() => setSection("queue")}
          >
            Queue & Log
          </HeaderButton>
          <HeaderButton
            active={section === "trash"}
            onClick={() => setSection("trash")}
          >
            Trash
          </HeaderButton>
          <HeaderButton
            active={section === "settings"}
            onClick={() => setSection("settings")}
          >
            Settings
          </HeaderButton>
          {section === "funnel" && (
            <HeaderButton onClick={() => setShowScreenOptions(true)}>
              Screen Options
            </HeaderButton>
          )}
        </div>
      </div>

      {section === "funnel" && (
        <FunnelSection
          columns={columns}
          showScreenOptions={showScreenOptions}
          setShowScreenOptions={setShowScreenOptions}
          pageSize={pageSize}
          setPageSize={setPageSize}
        />
      )}
      {section === "recovered" && <RecoveredSection />}
      {section === "campaigns" && <CampaignsSection />}
      {section === "queue" && <QueueSection />}
      {section === "trash" && <TrashSection />}
      {section === "settings" && <SettingsSection />}

      {showScreenOptions && (
        <ScreenOptionsModal
          columns={columns}
          onToggleColumn={toggleColumn}
          pageSize={pageSize}
          onPageSize={setPageSize}
          onClose={() => setShowScreenOptions(false)}
        />
      )}
    </div>
  );
}
