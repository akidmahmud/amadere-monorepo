"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Button, Icon, Modal } from "@amader/admin-ui";
import {
  COURIERS,
  PAGE_SIZE,
  labelOf,
  useAddWholesaleCustomerNote,
  useLogWholesaleCustomerCall,
  useWholesaleCustomerCrm,
  useWholesaleOrders,
  type WholesaleCustomer,
  type WholesaleCustomerCrm,
  type WholesaleOrder,
} from "@/hooks/useWholesale";
import { OrderDetailModal } from "./OrderDetailModal";
import { Pager } from "./Pager";
import {
  OrderCell,
  PaymentCell,
  ProductsCell,
  TypeBadge,
} from "./OrdersDashboard";

// Same values as the retail modal — the backend reuses the retail enums.
const NOTE_TYPES = ["CUSTOMER_FEEDBACK", "INTERNAL_NOTE", "REMARK"] as const;
const CALL_OUTCOMES = ["CONNECTED", "NO_ANSWER", "VOICEMAIL", "WRONG_NUMBER", "DECLINED"] as const;

const AVATAR_COLORS = ["#4299e1", "#48bb78", "#ed8936", "#9f7aea", "#f56565", "#38b2ac"];

const money = (v: string | number) =>
  `৳${Number(v || 0).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
const day = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString("en-GB") : null;
const moment = (v: string) => new Date(v).toLocaleString("en-GB");

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-sm text-muted">{children}</p>;
}

// Field / Section / Pill mirror the retail CustomerDetailModal so the two
// customer books open onto the same-looking record.
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

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-pill bg-surface-2 px-2.5 py-0.5 text-[0.7rem] font-bold text-secondary">
      {children}
    </span>
  );
}

/**
 * A wholesale buyer's whole record, in a modal — the same shape as the retail
 * Customer Management modal (identity strip, then tabs), replacing the old
 * full-page detail that swapped the customer list out from under you.
 */
export function WholesaleCustomerDetailModal({
  customer: c,
  onClose,
  onEdit,
  onOrder,
  onDelete,
  canDelete,
  deleting,
  deleteError,
}: {
  customer: WholesaleCustomer;
  onClose: () => void;
  onEdit: () => void;
  onOrder: () => void;
  onDelete: () => void;
  canDelete: boolean;
  deleting: boolean;
  deleteError: string | null;
}) {
  const [tab, setTab] = useState<
    "overview" | "orders" | "products" | "notes" | "calls" | "activity"
  >("overview");
  const crm = useWholesaleCustomerCrm(c.id).data;
  const tabs = [
    { key: "overview", label: "Overview", count: undefined },
    { key: "orders", label: "Orders", count: c.orderCount },
    { key: "products", label: "Products", count: crm?.purchasedProducts.length },
    { key: "notes", label: "Notes", count: crm?.notes.length },
    { key: "calls", label: "Calls", count: crm?.calls.length },
    { key: "activity", label: "Activity", count: crm?.activity.length },
  ] as const;

  return (
    <Modal open onClose={onClose} title={c.name} tone="dark" className="max-w-5xl">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface-2/60 p-4">
          <span
            className="grid h-12 w-12 flex-none place-items-center rounded-full text-lg font-extrabold text-white"
            style={{ background: AVATAR_COLORS[c.id % AVATAR_COLORS.length] }}
          >
            {c.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-bold text-text">{c.name}</span>
              {c.isFavorite && <Icon name="star" size={16} className="text-amber-500" />}
              {!c.isActive && <Pill>Inactive</Pill>}
              {c.priority && <Pill>{c.priority}</Pill>}
              {c.crmStatus && <Pill>{c.crmStatus}</Pill>}
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
              <p className="text-[0.68rem] font-bold uppercase text-muted">Orders</p>
              <p className="num text-lg font-bold text-text">{c.orderCount}</p>
            </div>
            <div>
              <p className="text-[0.68rem] font-bold uppercase text-muted">Purchase</p>
              <p className="num text-lg font-bold text-text">{money(c.purchaseTotal)}</p>
            </div>
            <div>
              <p className="text-[0.68rem] font-bold uppercase text-muted">Due</p>
              <p
                className={`num text-lg font-bold ${
                  Number(c.due) > 0 ? "text-rose-600 dark:text-rose-400" : "text-text"
                }`}
              >
                {money(c.due)}
              </p>
            </div>
          </div>
        </div>

        {deleteError && (
          <p className="rounded-lg bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
            {deleteError}
          </p>
        )}

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

        <div className="min-h-[240px]">
          {tab === "overview" && <OverviewTab c={c} />}
          {tab === "orders" && <OrdersTab customerId={c.id} />}
          {tab !== "overview" && tab !== "orders" && !crm && <Empty>Loading…</Empty>}
          {tab === "products" && crm && <ProductsTab products={crm.purchasedProducts} />}
          {tab === "notes" && crm && <NotesTab customerId={c.id} notes={crm.notes} />}
          {tab === "calls" && crm && (
            <CallsTab customerId={c.id} phone={c.phone} calls={crm.calls} />
          )}
          {tab === "activity" && crm && <ActivityTab activity={crm.activity} />}
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4">
          {canDelete && (
            <Button
              type="button"
              variant="ghost"
              disabled={deleting}
              onClick={onDelete}
              className="mr-auto text-rose-600 dark:text-rose-400"
            >
              <Icon name="delete" size={18} />
              Delete Customer
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={onEdit}>
            Edit Customer
          </Button>
          <Button type="button" variant="ghost" onClick={onOrder}>
            New Order
          </Button>
          <Button type="button" variant="primary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function OverviewTab({ c }: { c: WholesaleCustomer }) {
  return (
    <div className="flex flex-col gap-3">
      <Section title="Personal">
        <Field label="Full name">{c.name}</Field>
        <Field label="Phone">{c.phone}</Field>
        <Field label="Alt. phone">{c.alternativePhone}</Field>
        <Field label="Email">{c.email}</Field>
        <Field label="Birth date">{day(c.dob)}</Field>
        <Field label="Customer since">{day(c.createdAt)}</Field>
      </Section>

      <Section title="Address">
        <Field label="Address">{c.address}</Field>
        <Field label="Area / thana">{c.thana}</Field>
        <Field label="District">{c.district}</Field>
        <Field label="Landmark">{c.landmark}</Field>
        <Field label="Post code">{c.postCode}</Field>
      </Section>

      <Section title="Account">
        <Field label="Credit limit">{c.creditLimit ? money(c.creditLimit) : null}</Field>
        <Field label="Payment terms">
          {c.creditDays === null ? null : `${c.creditDays} days`}
        </Field>
        <Field label="Outstanding">{money(c.due)}</Field>
        <Field label="Wholesale orders">{c.wholesaleCount}</Field>
        <Field label="Channel orders">{c.channelCount}</Field>
        <Field label="Last order">{day(c.lastOrderAt)}</Field>
        <Field label="Top product">{c.topProduct}</Field>
        <Field label="RFM score">{c.rfmScore}</Field>
        {c.note && <Field label="Note">{c.note}</Field>}
      </Section>

      <Section title="CRM">
        <Field label="Assigned to">{c.assignedAdminName}</Field>
        <Field label="Priority">{c.priority ? <Pill>{c.priority}</Pill> : null}</Field>
        <Field label="Status">{c.crmStatus ? <Pill>{c.crmStatus}</Pill> : null}</Field>
        <Field label="Behaviour">{c.behaviour}</Field>
        <Field label="Favourite">{c.isFavorite ? "Yes" : "No"}</Field>
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

/**
 * Fetched by `partyId`, not filtered out of the dashboard's order list: that
 * list is one page, so filtering it client-side would show a "complete
 * history" that silently stopped at the last page it happened to hold.
 */
function OrdersTab({ customerId }: { customerId: number }) {
  const [page, setPage] = useState(1);
  const history = useWholesaleOrders("", "ALL", "ALL", customerId, page);
  const [viewing, setViewing] = useState<WholesaleOrder | null>(null);
  const orders = history.data?.items ?? [];

  if (history.isLoading)
    return <p className="py-10 text-center text-sm text-muted">Loading history…</p>;
  if (orders.length === 0)
    return <p className="py-10 text-center text-sm text-muted">No orders yet.</p>;

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[820px] border-collapse">
          <thead>
            <tr className="bg-surface-2 text-[9px] uppercase tracking-wide text-muted">
              {["Order", "Type", "Products", "Courier", "Payment", "Total", "Date"].map((h) => (
                <th key={h} className="px-3 py-2.5 text-left font-bold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr
                key={o.id}
                onClick={() => setViewing(o)}
                className="cursor-pointer border-t border-border align-top text-[11px] transition-colors hover:bg-surface-2"
              >
                <td className="px-3 py-3">
                  <OrderCell order={o} />
                </td>
                <td className="px-3 py-3">
                  <TypeBadge order={o} />
                </td>
                <td className="px-3 py-3">
                  <ProductsCell order={o} />
                </td>
                <td className="px-3 py-3">
                  <span className="block text-text">{labelOf(COURIERS, o.courier) || "N/A"}</span>
                  {o.consignmentId && <span className="text-muted">{o.consignmentId}</span>}
                </td>
                <td className="px-3 py-3">
                  <PaymentCell order={o} />
                </td>
                <td className="px-3 py-3">
                  <strong className="block text-text">{money(o.total)}</strong>
                  {Number(o.due) > 0 && (
                    <span className="text-rose-600 dark:text-rose-400">{money(o.due)} due</span>
                  )}
                </td>
                <td className="px-3 py-3 text-secondary">{day(o.placedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager
        page={page}
        pageSize={PAGE_SIZE}
        total={history.data?.total ?? 0}
        onPage={setPage}
        noun="orders"
      />
      {viewing && <OrderDetailModal order={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function ProductsTab({ products }: { products: WholesaleCustomerCrm["purchasedProducts"] }) {
  if (products.length === 0) return <Empty>Nothing bought yet.</Empty>;
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[620px] text-sm">
        <thead className="bg-surface-2 text-xs text-secondary">
          <tr>
            {["Product", "Qty", "Orders", "Spent", "Last bought"].map((h) => (
              <th key={h} className="px-4 py-2.5 text-left font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.productId ?? p.name} className="border-t border-border">
              <td className="px-4 py-2.5">
                {/* productId is null once the product itself is deleted. */}
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

const inputCls =
  "h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

function NotesTab({
  customerId,
  notes,
}: {
  customerId: number;
  notes: WholesaleCustomerCrm["notes"];
}) {
  const addNote = useAddWholesaleCustomerNote(customerId);
  const [type, setType] = useState<string>(NOTE_TYPES[1]);
  const [body, setBody] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-wrap items-end gap-2.5 rounded-xl border border-border bg-surface-2/40 p-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!body.trim()) return;
          addNote.mutate({ type, body: body.trim() }, { onSuccess: () => setBody("") });
        }}
      >
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          aria-label="Note type"
          className={inputCls}
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
          className={`${inputCls} min-w-56 flex-1`}
        />
        <Button type="submit" variant="primary" disabled={addNote.isPending || !body.trim()}>
          {addNote.isPending ? "Adding…" : "Add"}
        </Button>
      </form>
      {notes.length === 0 ? (
        <Empty>No notes yet.</Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {notes.map((n) => (
            <div key={n.id} className="rounded-xl border border-border p-3.5">
              <div className="flex items-center justify-between gap-3">
                <Pill>{n.type.replace(/_/g, " ")}</Pill>
                <span className="text-xs text-muted">
                  {n.authorName} · {moment(n.createdAt)}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-text">{n.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CallsTab({
  customerId,
  phone,
  calls,
}: {
  customerId: number;
  phone: string | null;
  calls: WholesaleCustomerCrm["calls"];
}) {
  const logCall = useLogWholesaleCustomerCall(customerId);
  const [outcome, setOutcome] = useState<string>(CALL_OUTCOMES[0]);
  const [notes, setNotes] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-surface-2/40 p-3.5">
        {/* ponytail: tel: link, not the retail "Call now" API — no call
            provider is configured yet, so that button only ever errors. */}
        {phone && (
          <a
            href={`tel:${phone}`}
            className="inline-flex items-center gap-1.5 self-start rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            <Icon name="call" size={16} />
            Call {phone}
          </a>
        )}
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
            className={inputCls}
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
            className={`${inputCls} min-w-56 flex-1`}
          />
          <Button type="submit" variant="ghost" disabled={logCall.isPending}>
            {logCall.isPending ? "Logging…" : "Log outcome"}
          </Button>
        </form>
      </div>
      {calls.length === 0 ? (
        <Empty>No calls logged yet.</Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {calls.map((cl) => (
            <div key={cl.id} className="rounded-xl border border-border p-3.5">
              <div className="flex items-center justify-between gap-3">
                <Pill>{cl.outcome.replace(/_/g, " ")}</Pill>
                <span className="text-xs text-muted">
                  {cl.authorName} · {moment(cl.createdAt)}
                </span>
              </div>
              {cl.notes && <p className="mt-1.5 text-sm text-text">{cl.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityTab({ activity }: { activity: WholesaleCustomerCrm["activity"] }) {
  if (activity.length === 0) return <Empty>No activity yet.</Empty>;
  return (
    <ol className="flex flex-col">
      {activity.map((e, i) => (
        <li key={i} className="border-l-2 border-border pb-4 pl-4 last:pb-0">
          <div className="flex flex-wrap items-center gap-2">
            <Pill>{e.type}</Pill>
            <span className="text-xs text-muted">{moment(e.occurredAt)}</span>
          </div>
          <p className="mt-1 text-sm text-text">{e.text}</p>
        </li>
      ))}
    </ol>
  );
}
