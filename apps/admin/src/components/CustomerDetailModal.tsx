"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Button, Icon, Modal } from "@amader/admin-ui";
import { useCan } from "@/hooks/useAdminAuth";
import {
  BD_ALL_DISTRICTS,
  BD_DIVISIONS,
  BD_THANAS_BY_DISTRICT,
  divisionForDistrict,
} from "@amader/shared";
import {
  useAddCustomerNote,
  useAssignableStaff,
  useCustomer,
  useDialCustomer,
  useLogCustomerCall,
  useUpdateCustomer,
  type UpdateCustomerInput,
} from "@/hooks/useCustomers";

const NOTE_TYPES = ["CUSTOMER_FEEDBACK", "INTERNAL_NOTE", "REMARK"] as const;
const CALL_OUTCOMES = ["CONNECTED", "NO_ANSWER", "VOICEMAIL", "WRONG_NUMBER", "DECLINED"] as const;

const AVATAR_COLORS = ["#4299e1", "#48bb78", "#ed8936", "#9f7aea", "#f56565", "#38b2ac"];

const money = (v: string | number) =>
  `৳${Number(v).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
const day = (v: string | Date | null | undefined) =>
  v ? new Date(v).toLocaleDateString("en-GB") : null;
const moment = (v: string | Date) => new Date(v).toLocaleString("en-GB");

type Customer = NonNullable<ReturnType<typeof useCustomer>["data"]>;

/**
 * One label/value pair. Renders an em dash rather than vanishing when empty —
 * "we have no birthday for them" is information, and a field that disappears
 * would make the grid reflow every time you open a different customer.
 */
function Field({ label, children }: { label: string; children?: ReactNode }) {
  const empty = children === null || children === undefined || children === "";
  return (
    <div className="min-w-0">
      <dt className="text-[0.68rem] font-bold uppercase tracking-wide text-muted">{label}</dt>
      <dd className={`mt-0.5 break-words text-sm ${empty ? "text-muted" : "text-text"}`}>
        {empty ? "—" : children}
      </dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface-2/40 p-4">
      <h4 className="mb-3 text-[0.72rem] font-bold uppercase tracking-wide text-secondary">
        {title}
      </h4>
      <dl className="grid grid-cols-2 gap-x-5 gap-y-3.5 sm:grid-cols-3">{children}</dl>
    </section>
  );
}

function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "brand" }) {
  return (
    <span
      className={`inline-block rounded-pill px-2.5 py-0.5 text-[0.7rem] font-bold ${
        tone === "brand"
          ? "bg-brand-500/12 text-brand-600 dark:text-brand-400"
          : "bg-surface-2 text-secondary"
      }`}
    >
      {children}
    </span>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-sm text-muted">{children}</p>;
}

/**
 * The whole customer, in one place.
 *
 * This used to be a summary with an "Edit →" that handed off to
 * /customers/[id] for everything real — so half the record was invisible until
 * you left the list, and the CRM fields (priority, follow-up, feedback) were
 * only ever visible as inline inputs in the table. That page is gone; its tabs
 * live here, alongside an Overview that shows every stored field.
 */
export function CustomerDetailModal({
  customerId,
  onClose,
}: {
  customerId: number;
  onClose: () => void;
}) {
  const { data: c, isLoading } = useCustomer(customerId);
  const [tab, setTab] = useState<
    "overview" | "orders" | "products" | "notes" | "calls" | "activity"
  >("overview");

  const tabs = [
    { key: "overview", label: "Overview", count: undefined },
    { key: "orders", label: "Orders", count: c?.orders.length },
    { key: "products", label: "Products", count: c?.purchasedProducts.length },
    { key: "notes", label: "Notes", count: c?.notes.length },
    { key: "calls", label: "Calls", count: c?.callLogs.length },
    { key: "activity", label: "Activity", count: c?.activity.length },
  ] as const;

  return (
    <Modal open onClose={onClose} title={c?.name ?? "Customer"} tone="dark" className="max-w-5xl">
      {isLoading || !c ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Identity strip — the things you need before deciding anything
              else: who they are, how to reach them, what they are worth. */}
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface-2/60 p-4">
            <span
              className="grid h-12 w-12 flex-none place-items-center rounded-full text-lg font-extrabold text-white"
              style={{ background: AVATAR_COLORS[customerId % AVATAR_COLORS.length] }}
            >
              {c.name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-bold text-text">{c.name}</span>
                {c.isFavorite && <Icon name="star" size={16} className="text-amber-500" />}
                {c.tier && <Pill tone="brand">{c.tier}</Pill>}
                {c.priority && <Pill>{c.priority}</Pill>}
                {c.crmStatus && <Pill>{c.crmStatus}</Pill>}
                {c.hasNewOrder && <Pill tone="brand">New order</Pill>}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm">
                {c.phone ? (
                  <a
                    href={`tel:${c.phone}`}
                    className="inline-flex items-center gap-1 font-semibold text-brand-500 hover:underline"
                  >
                    <Icon name="call" size={14} />
                    {c.phone}
                  </a>
                ) : (
                  <span className="text-muted">no phone</span>
                )}
                {c.email ? (
                  <a
                    href={`mailto:${c.email}`}
                    className="inline-flex items-center gap-1 text-secondary hover:underline"
                  >
                    <Icon name="mail" size={14} />
                    {c.email}
                  </a>
                ) : (
                  <span className="text-muted">no email</span>
                )}
                {c.facebookProfileUrl && (
                  <a
                    href={c.facebookProfileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-secondary hover:underline"
                  >
                    <Icon name="link" size={14} />
                    Facebook
                  </a>
                )}
              </div>
            </div>
            <div className="flex flex-none gap-6 text-right">
              <div>
                <p className="text-[0.68rem] font-bold uppercase text-muted">Completed</p>
                <p className="num text-lg font-bold text-text">{c.completedOrderCount}</p>
              </div>
              <div>
                <p className="text-[0.68rem] font-bold uppercase text-muted">Orders</p>
                <p className="num text-lg font-bold text-text">{c.orders.length}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 border-b border-border">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`-mb-px border-b-2 px-3.5 py-2 text-sm font-semibold transition-colors ${
                  tab === t.key
                    ? "border-brand-500 text-brand-500"
                    : "border-transparent text-secondary hover:text-text"
                }`}
              >
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span className="ml-1.5 rounded-pill bg-surface-2 px-1.5 py-0.5 text-[0.66rem] font-bold text-secondary">
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* A floor, so switching to an empty tab does not collapse the
              modal and move the tab strip out from under the cursor. */}
          <div className="min-h-[240px]">
            {tab === "overview" && <OverviewTab c={c} />}
            {tab === "orders" && <OrdersTab orders={c.orders} />}
            {tab === "products" && <ProductsTab products={c.purchasedProducts} />}
            {tab === "notes" && <NotesTab customerId={customerId} notes={c.notes} />}
            {tab === "calls" && <CallsTab customerId={customerId} calls={c.callLogs} />}
            {tab === "activity" && <ActivityTab activity={c.activity as ActivityEntry[]} />}
          </div>

          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <Link href={`/orders/new?customerId=${customerId}`}>
              <Button type="button" variant="ghost">
                New Order
              </Button>
            </Link>
            <Button type="button" variant="primary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function OverviewTab({ c }: { c: Customer }) {
  const canManage = useCan("customer.manage");
  const [editing, setEditing] = useState(false);
  if (editing) return <OverviewEditor c={c} onDone={() => setEditing(false)} />;
  const a = c.defaultAddress;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          disabled={!canManage}
          title={canManage ? undefined : "View only — you do not have permission to edit customers"}
          onClick={() => setEditing(true)}
        >
          <Icon name="edit" size={16} />
          Edit details
        </Button>
      </div>
      <Section title="Personal">
        <Field label="Full name">{c.name}</Field>
        <Field label="Phone">{c.phone}</Field>
        <Field label="Email">{c.email}</Field>
        <Field label="Birth date">{day(c.dob)}</Field>
        <Field label="Customer since">{day(c.createdAt)}</Field>
        <Field label="Group / tier">{c.tier}</Field>
      </Section>

      <Section title="Default address">
        <Field label="Recipient">{a?.recipientName}</Field>
        <Field label="Phone">{a?.phone}</Field>
        <Field label="Alt. phone">{a?.alternativePhone}</Field>
        <Field label="Address">{a?.addressLine}</Field>
        <Field label="Area / thana">{a?.area}</Field>
        <Field label="District">{a?.district}</Field>
        <Field label="Division">{a?.division}</Field>
        <Field label="Landmark">{a?.landmark}</Field>
        <Field label="Post code">{a?.postCode}</Field>
      </Section>

      <Section title="CRM">
        <Field label="Assigned to">{c.assignedAdminName}</Field>
        <Field label="Priority">{c.priority ? <Pill>{c.priority}</Pill> : null}</Field>
        <Field label="Status">{c.crmStatus ? <Pill>{c.crmStatus}</Pill> : null}</Field>
        <Field label="Behaviour">{c.behaviour}</Field>
        <Field label="Favourite">{c.isFavorite ? "Yes" : "No"}</Field>
        <Field label="Completed orders">{c.completedOrderCount}</Field>
      </Section>

      <Section title="Follow-up">
        <Field label="Next call target">{day(c.nextCallTarget)}</Field>
        <Field label="Cadence">
          {c.followUpCadenceDays ? `Every ${c.followUpCadenceDays} days` : null}
        </Field>
        <Field label="New order flag">{c.hasNewOrder ? "Yes" : "No"}</Field>
        <Field label="New order at">{day(c.newOrderAt)}</Field>
      </Section>

      <Section title="Notes on the person">
        <Field label="Customer feedback">{c.customerFeedback}</Field>
        <Field label="Agent feedback">{c.amaderFeedback}</Field>
        <Field label="Family details">{c.familyDetails}</Field>
        <Field label="Reason for purchase">{c.purchaseReason}</Field>
      </Section>
    </div>
  );
}

const PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;
const CRM_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "FOLLOW_UP", "DONE"] as const;
const BEHAVIOURS = ["LOYAL", "PRICE_SENSITIVE", "OCCASIONAL"] as const;

const editCls =
  "h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm text-text outline-none focus:border-brand-500";
const isoDay = (v: string | Date | null | undefined) =>
  v ? new Date(v).toISOString().slice(0, 10) : "";

function EditField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[0.68rem] font-bold uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

/**
 * Every stored field of the Overview, as inputs. Tier, "customer since" and
 * completed orders stay read-only: tier is recalculated from completed orders,
 * and the other two are facts, not settings.
 */
function OverviewEditor({ c, onDone }: { c: Customer; onDone: () => void }) {
  const update = useUpdateCustomer(c.id);
  const { data: staff } = useAssignableStaff();
  const canAssign = useCan("assignment.manage");
  const a = c.defaultAddress;
  const initial = {
    firstName: c.firstName ?? "",
    lastName: c.lastName ?? "",
    phone: c.phone ?? "",
    email: c.email ?? "",
    dob: isoDay(c.dob),
    facebookProfileUrl: c.facebookProfileUrl ?? "",
    recipientName: a?.recipientName ?? "",
    addressPhone: a?.phone ?? "",
    alternativePhone: a?.alternativePhone ?? "",
    addressLine: a?.addressLine ?? "",
    area: a?.area ?? "",
    district: a?.district ?? "",
    division: a?.division ?? "",
    landmark: a?.landmark ?? "",
    postCode: a?.postCode ?? "",
    assignedAdminId: c.assignedAdminId ? String(c.assignedAdminId) : "",
    priority: c.priority ?? "",
    crmStatus: c.crmStatus ?? "",
    behaviour: c.behaviour ?? "",
    isFavorite: c.isFavorite,
    nextCallTarget: isoDay(c.nextCallTarget),
    followUpCadenceDays: c.followUpCadenceDays ? String(c.followUpCadenceDays) : "",
    hasNewOrder: c.hasNewOrder,
    newOrderAt: isoDay(c.newOrderAt),
    customerFeedback: c.customerFeedback ?? "",
    amaderFeedback: c.amaderFeedback ?? "",
    familyDetails: c.familyDetails ?? "",
    purchaseReason: c.purchaseReason ?? "",
  };
  const [f, setF] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  type Key = keyof typeof initial;
  const set = <K extends Key>(k: K, v: (typeof initial)[K]) => setF((prev) => ({ ...prev, [k]: v }));
  const text = (k: Key, type = "text") => (
    <input
      type={type}
      value={f[k] as string}
      onChange={(e) => set(k, e.target.value as never)}
      className={editCls}
    />
  );
  const select = (k: Key, options: readonly string[]) => (
    <select value={f[k] as string} onChange={(e) => set(k, e.target.value as never)} className={editCls}>
      <option value="">—</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o.replace(/_/g, " ")}
        </option>
      ))}
    </select>
  );
  const area = (k: Key) => (
    <textarea
      rows={2}
      value={f[k] as string}
      onChange={(e) => set(k, e.target.value as never)}
      className={`${editCls} h-auto py-2`}
    />
  );
  const thanas = BD_THANAS_BY_DISTRICT[f.district] ?? [];

  function save() {
    const changed = (k: Key) => f[k] !== initial[k];
    const orNull = (v: string) => v || null;
    const patch: UpdateCustomerInput = {};
    // Plain text: empty clears it.
    for (const k of [
      "firstName", "lastName", "recipientName", "alternativePhone", "addressLine", "area",
      "district", "division", "landmark", "postCode", "customerFeedback", "amaderFeedback",
      "familyDetails", "purchaseReason",
    ] as const) {
      if (changed(k)) patch[k] = f[k];
    }
    // Validated server-side (phone / email / URL) — an empty value would be
    // rejected, so these can be changed but not blanked from here.
    for (const k of ["phone", "email", "addressPhone", "facebookProfileUrl"] as const) {
      if (changed(k) && f[k].trim()) patch[k] = f[k].trim();
    }
    if (changed("dob")) patch.dob = orNull(f.dob);
    if (changed("nextCallTarget")) patch.nextCallTarget = orNull(f.nextCallTarget);
    if (changed("newOrderAt")) patch.newOrderAt = orNull(f.newOrderAt);
    if (changed("assignedAdminId")) patch.assignedAdminId = f.assignedAdminId ? Number(f.assignedAdminId) : null;
    if (changed("followUpCadenceDays"))
      patch.followUpCadenceDays = f.followUpCadenceDays ? Number(f.followUpCadenceDays) : null;
    if (changed("priority")) patch.priority = (f.priority || null) as UpdateCustomerInput["priority"];
    if (changed("crmStatus")) patch.crmStatus = (f.crmStatus || null) as UpdateCustomerInput["crmStatus"];
    if (changed("behaviour")) patch.behaviour = (f.behaviour || null) as UpdateCustomerInput["behaviour"];
    if (changed("isFavorite")) patch.isFavorite = f.isFavorite;
    if (changed("hasNewOrder")) patch.hasNewOrder = f.hasNewOrder;

    if (Object.keys(patch).length === 0) return onDone();
    setError(null);
    update.mutate(patch, {
      onSuccess: onDone,
      onError: (err) => setError(err instanceof Error ? err.message : "Save failed"),
    });
  }

  const grid = "grid grid-cols-2 gap-x-5 gap-y-3.5 sm:grid-cols-3";
  const box = (title: string, children: ReactNode) => (
    <section className="rounded-xl border border-border bg-surface-2/40 p-4">
      <h4 className="mb-3 text-[0.72rem] font-bold uppercase tracking-wide text-secondary">{title}</h4>
      <div className={grid}>{children}</div>
    </section>
  );

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {box(
        "Personal",
        <>
          <EditField label="First name">{text("firstName")}</EditField>
          <EditField label="Last name">{text("lastName")}</EditField>
          <EditField label="Phone">{text("phone", "tel")}</EditField>
          <EditField label="Email">{text("email", "email")}</EditField>
          <EditField label="Birth date">{text("dob", "date")}</EditField>
          <EditField label="Facebook profile">{text("facebookProfileUrl", "url")}</EditField>
        </>,
      )}
      {box(
        "Default address",
        <>
          <EditField label="Recipient">{text("recipientName")}</EditField>
          <EditField label="Phone">{text("addressPhone", "tel")}</EditField>
          <EditField label="Alt. phone">{text("alternativePhone", "tel")}</EditField>
          <EditField label="Address">{text("addressLine")}</EditField>
          <EditField label="District">
            <select
              value={f.district}
              onChange={(e) => {
                const d = e.target.value;
                setF((prev) => ({ ...prev, district: d, division: divisionForDistrict(d) ?? prev.division }));
              }}
              className={editCls}
            >
              <option value="">—</option>
              {/* Keep an old free-typed district selectable instead of silently dropping it. */}
              {f.district && !BD_ALL_DISTRICTS.includes(f.district) && (
                <option value={f.district}>{f.district}</option>
              )}
              {BD_ALL_DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </EditField>
          <EditField label="Area / thana">
            <input
              list={`thanas-${c.id}`}
              value={f.area}
              onChange={(e) => set("area", e.target.value)}
              className={editCls}
            />
            <datalist id={`thanas-${c.id}`}>
              {thanas.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </EditField>
          <EditField label="Division">{select("division", BD_DIVISIONS)}</EditField>
          <EditField label="Landmark">{text("landmark")}</EditField>
          <EditField label="Post code">{text("postCode")}</EditField>
        </>,
      )}
      {box(
        "CRM",
        <>
          <EditField label="Assigned to">
            <select
              value={f.assignedAdminId}
              disabled={!canAssign}
              title={canAssign ? undefined : "You do not have permission to reassign customers"}
              onChange={(e) => set("assignedAdminId", e.target.value)}
              className={`${editCls} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <option value="">Unassigned</option>
              {(staff ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </EditField>
          <EditField label="Priority">{select("priority", PRIORITIES)}</EditField>
          <EditField label="Status">{select("crmStatus", CRM_STATUSES)}</EditField>
          <EditField label="Behaviour">{select("behaviour", BEHAVIOURS)}</EditField>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-text">
            <input
              type="checkbox"
              checked={f.isFavorite}
              onChange={(e) => set("isFavorite", e.target.checked)}
            />
            Favourite
          </label>
        </>,
      )}
      {box(
        "Follow-up",
        <>
          <EditField label="Next call target">{text("nextCallTarget", "date")}</EditField>
          <EditField label="Cadence">
            <select
              value={f.followUpCadenceDays}
              onChange={(e) => set("followUpCadenceDays", e.target.value)}
              className={editCls}
            >
              <option value="">—</option>
              {/* An imported custom cadence stays selectable. */}
              {f.followUpCadenceDays && !["7", "15", "30"].includes(f.followUpCadenceDays) && (
                <option value={f.followUpCadenceDays}>Every {f.followUpCadenceDays} days</option>
              )}
              {["7", "15", "30"].map((d) => (
                <option key={d} value={d}>
                  Every {d} days
                </option>
              ))}
            </select>
          </EditField>
          <EditField label="New order at">{text("newOrderAt", "date")}</EditField>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-text">
            <input
              type="checkbox"
              checked={f.hasNewOrder}
              onChange={(e) => set("hasNewOrder", e.target.checked)}
            />
            New order flag
          </label>
        </>,
      )}
      {box(
        "Notes on the person",
        <>
          <EditField label="Customer feedback">{area("customerFeedback")}</EditField>
          <EditField label="Agent feedback">{area("amaderFeedback")}</EditField>
          <EditField label="Family details">{area("familyDetails")}</EditField>
          <EditField label="Reason for purchase">{area("purchaseReason")}</EditField>
        </>,
      )}
      {error && (
        <p className="rounded-lg bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone} disabled={update.isPending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function OrdersTab({ orders }: { orders: Customer["orders"] }) {
  if (orders.length === 0) return <Empty>No orders yet.</Empty>;
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[520px] text-sm">
        <thead className="bg-surface-2 text-xs text-secondary">
          <tr>
            <th className="px-4 py-2.5 text-left font-semibold">Order</th>
            <th className="px-4 py-2.5 text-left font-semibold">Products</th>
            <th className="px-4 py-2.5 text-left font-semibold">Placed</th>
            <th className="px-4 py-2.5 text-left font-semibold">Status</th>
            <th className="px-4 py-2.5 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-t border-border">
              <td className="px-4 py-2.5 font-semibold text-text">{o.orderNumber}</td>
              <td className="px-4 py-2.5 text-xs text-text">
                {o.products.map((p, i) => (
                  <span key={i} className="block">
                    {p}
                  </span>
                ))}
              </td>
              <td className="px-4 py-2.5 text-xs text-secondary">{day(o.createdAt)}</td>
              <td className="px-4 py-2.5">
                <Pill>{o.status}</Pill>
              </td>
              <td className="num px-4 py-2.5 text-right text-text">{money(o.totalAmount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductsTab({ products }: { products: Customer["purchasedProducts"] }) {
  if (products.length === 0) return <Empty>Nothing bought yet.</Empty>;
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[620px] text-sm">
        <thead className="bg-surface-2 text-xs text-secondary">
          <tr>
            <th className="px-4 py-2.5 text-left font-semibold">Product</th>
            <th className="px-4 py-2.5 text-left font-semibold">Qty</th>
            <th className="px-4 py-2.5 text-left font-semibold">Orders</th>
            <th className="px-4 py-2.5 text-left font-semibold">Spent</th>
            <th className="px-4 py-2.5 text-left font-semibold">Last bought</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.productId ?? p.name} className="border-t border-border">
              <td className="px-4 py-2.5">
                {/* productId is null once the product row itself is deleted;
                    the snapshot name still shows, just without a link. */}
                {p.productId ? (
                  <Link
                    href={`/products/${p.productId}`}
                    className="font-semibold text-brand-500 hover:underline"
                  >
                    {p.name}
                  </Link>
                ) : (
                  <span className="font-semibold text-text">{p.name}</span>
                )}
                {p.sku && <span className="ml-2 text-xs text-muted">{p.sku}</span>}
              </td>
              <td className="num px-4 py-2.5 text-text">{p.totalQuantity}</td>
              <td className="num px-4 py-2.5 text-text">{p.orderCount}</td>
              <td className="num px-4 py-2.5 text-text">{money(p.totalSpent)}</td>
              <td className="px-4 py-2.5 text-xs text-secondary">{day(p.lastPurchasedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NotesTab({ customerId, notes }: { customerId: number; notes: Customer["notes"] }) {
  const addNote = useAddCustomerNote(customerId);
  const canManage = useCan("customer.manage");
  const [type, setType] = useState<string>(NOTE_TYPES[1]);
  const [body, setBody] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-wrap items-end gap-2.5 rounded-xl border border-border bg-surface-2/40 p-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canManage || !body.trim()) return;
          addNote.mutate({ type, body: body.trim() }, { onSuccess: () => setBody("") });
        }}
      >
        <fieldset
          disabled={!canManage}
          title={canManage ? undefined : "View only — you do not have permission to add notes"}
          className="contents disabled:[&_*]:cursor-not-allowed disabled:[&_*]:opacity-50"
        >
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          aria-label="Note type"
          className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        >
          {NOTE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a note…"
          className="h-10 min-w-56 flex-1 rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        />
        <Button type="submit" variant="primary" disabled={addNote.isPending || !body.trim()}>
          {addNote.isPending ? "Adding…" : "Add"}
        </Button>
        </fieldset>
      </form>
      {notes.length === 0 ? (
        <Empty>No notes yet.</Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {notes.map((n) => (
            <div key={n.id} className="rounded-xl border border-border p-3.5">
              <div className="flex items-center justify-between gap-3">
                <Pill>{n.type.replace(/_/g, " ")}</Pill>
                <span className="text-xs text-muted">{moment(n.createdAt)}</span>
              </div>
              <p className="mt-1.5 text-sm text-text">{n.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CallsTab({ customerId, calls }: { customerId: number; calls: Customer["callLogs"] }) {
  const logCall = useLogCustomerCall(customerId);
  const canManage = useCan("customer.manage");
  const dial = useDialCustomer(customerId);
  const [outcome, setOutcome] = useState<string>(CALL_OUTCOMES[0]);
  const [notes, setNotes] = useState("");
  const [failure, setFailure] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <fieldset
        disabled={!canManage}
        title={canManage ? undefined : "View only — you do not have permission to log calls"}
        className="flex flex-col gap-2.5 rounded-xl border border-border bg-surface-2/40 p-3.5 disabled:[&_*]:cursor-not-allowed disabled:[&_*]:opacity-50"
      >
        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="primary"
            disabled={dial.isPending}
            onClick={() => {
              setFailure(null);
              dial.mutate(undefined, {
                onError: (err) =>
                  setFailure(err instanceof Error ? err.message : "Call failed"),
              });
            }}
          >
            <Icon name="call" size={16} />
            {dial.isPending ? "Dialing…" : "Call now"}
          </Button>
          {failure && <span className="text-xs text-danger">{failure}</span>}
        </div>
        <form
          className="flex flex-wrap items-end gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            logCall.mutate(
              { outcome, notes: notes.trim() || undefined },
              { onSuccess: () => setNotes("") },
            );
          }}
        >
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            aria-label="Call outcome"
            className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          >
            {CALL_OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {o.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What happened on the call?"
            className="h-10 min-w-56 flex-1 rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
          <Button type="submit" variant="ghost" disabled={logCall.isPending}>
            {logCall.isPending ? "Logging…" : "Log outcome"}
          </Button>
        </form>
      </fieldset>
      {calls.length === 0 ? (
        <Empty>No calls logged yet.</Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {calls.map((cl) => (
            <div key={cl.id} className="rounded-xl border border-border p-3.5">
              <div className="flex items-center justify-between gap-3">
                <Pill>{cl.outcome.replace(/_/g, " ")}</Pill>
                <span className="text-xs text-muted">{moment(cl.createdAt)}</span>
              </div>
              {cl.notes && <p className="mt-1.5 text-sm text-text">{cl.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// The mapper always populates `type` and `occurredAt` on every activity entry
// (see toAdminCustomerDto). NestJS Swagger cannot reflect the source union, so
// the generated type is only Record<string, unknown>[] — this bridges a real,
// verified gap between the DTO's public type and its runtime shape.
type ActivityEntry = { type: string; occurredAt: string; [key: string]: unknown };

function ActivityTab({ activity }: { activity: ActivityEntry[] }) {
  if (activity.length === 0) return <Empty>No activity yet.</Empty>;
  return (
    <ol className="flex flex-col">
      {activity.map((e, i) => (
        <li key={i} className="border-l-2 border-border pb-4 pl-4 last:pb-0">
          <div className="flex flex-wrap items-center gap-2">
            <Pill>{e.type}</Pill>
            <span className="text-xs text-muted">{moment(e.occurredAt)}</span>
          </div>
          <p className="mt-1 text-sm text-text">
            {e.type === "ORDER" && `Order ${e.orderNumber} → ${e.status}`}
            {e.type === "NOTE" && `Note (${e.noteType}): ${e.body}`}
            {e.type === "CALL" && `Call: ${e.outcome}`}
          </p>
        </li>
      ))}
    </ol>
  );
}
