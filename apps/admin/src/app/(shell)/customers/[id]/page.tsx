"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Button, Card, Icon, PageHeader, Tabs } from "@amader/admin-ui";
import {
  useAddCustomerNote,
  useCustomer,
  useDialCustomer,
  useLogCustomerCall,
} from "@/hooks/useCustomers";

const customerIcon = <Icon name="person" />;

const NOTE_TYPES = ["CUSTOMER_FEEDBACK", "INTERNAL_NOTE", "REMARK"] as const;
const CALL_OUTCOMES = ["CONNECTED", "NO_ANSWER", "VOICEMAIL", "WRONG_NUMBER", "DECLINED"] as const;

function NotesTab({ customerId, notes }: { customerId: number; notes: { id: number; type: string; body: string; createdAt: string }[] }) {
  const addNote = useAddCustomerNote(customerId);
  const [type, setType] = useState<string>(NOTE_TYPES[1]);
  const [body, setBody] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!body.trim()) return;
            addNote.mutate({ type, body: body.trim() }, { onSuccess: () => setBody("") });
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            >
              {NOTE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Note</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand-500"
            />
          </label>
          <Button type="submit" variant="primary" disabled={addNote.isPending} className="self-start">
            {addNote.isPending ? "Adding…" : "Add note"}
          </Button>
        </form>
      </Card>
      <div className="flex flex-col gap-2.5">
        {notes.length === 0 && <p className="text-sm text-muted">No notes yet.</p>}
        {notes.map((n) => (
          <Card key={n.id} className="flex flex-col gap-1">
            <span className="rounded-pill bg-surface-2 px-2.5 py-1 text-xs font-semibold text-secondary self-start">{n.type}</span>
            <p className="text-sm text-text">{n.body}</p>
            <span className="text-xs text-muted">{new Date(n.createdAt).toLocaleString()}</span>
          </Card>
        ))}
      </div>
    </div>
  );
}

function CallLogTab({
  customerId,
  calls,
}: {
  customerId: number;
  calls: { id: number; outcome: string; notes: string | null; createdAt: string }[];
}) {
  const logCall = useLogCustomerCall(customerId);
  const dial = useDialCustomer(customerId);
  const [outcome, setOutcome] = useState<string>(CALL_OUTCOMES[0]);
  const [notes, setNotes] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <Button
          type="button"
          variant="primary"
          className="self-start"
          disabled={dial.isPending}
          onClick={() =>
            dial.mutate(undefined, {
              onError: (err) => alert(err instanceof Error ? err.message : "Call failed"),
            })
          }
        >
          {dial.isPending ? "Dialing…" : "Call"}
        </Button>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            logCall.mutate({ outcome, notes: notes.trim() || undefined }, { onSuccess: () => setNotes("") });
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Outcome</span>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            >
              {CALL_OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand-500"
            />
          </label>
          <Button type="submit" variant="ghost" disabled={logCall.isPending} className="self-start">
            {logCall.isPending ? "Logging…" : "Log call outcome"}
          </Button>
        </form>
      </Card>
      <div className="flex flex-col gap-2.5">
        {calls.length === 0 && <p className="text-sm text-muted">No calls logged yet.</p>}
        {calls.map((c) => (
          <Card key={c.id} className="flex flex-col gap-1">
            <span className="rounded-pill bg-surface-2 px-2.5 py-1 text-xs font-semibold text-secondary self-start">{c.outcome}</span>
            {c.notes && <p className="text-sm text-text">{c.notes}</p>}
            <span className="text-xs text-muted">{new Date(c.createdAt).toLocaleString()}</span>
          </Card>
        ))}
      </div>
    </div>
  );
}

function OrderHistoryTab({ orders }: { orders: { id: number; orderNumber: string; status: string; totalAmount: string; createdAt: string }[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      {orders.length === 0 && <p className="text-sm text-muted">No orders yet.</p>}
      {orders.map((o) => (
        <Card key={o.id} className="flex items-center justify-between">
          <div>
            <p className="font-ui text-sm font-semibold text-text">{o.orderNumber}</p>
            <p className="text-xs text-muted">{new Date(o.createdAt).toLocaleString()}</p>
          </div>
          <div className="text-right">
            <span className="rounded-pill bg-surface-2 px-2.5 py-1 text-xs font-semibold text-secondary">{o.status}</span>
            <p className="num mt-1 text-sm text-text">৳{o.totalAmount}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}

function ActivityTab({
  activity,
}: {
  activity: { type: string; occurredAt: string; [key: string]: unknown }[];
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {activity.length === 0 && <p className="text-sm text-muted">No activity yet.</p>}
      {activity.map((entry, i) => (
        <Card key={i} className="flex items-center justify-between">
          <div>
            <span className="rounded-pill bg-surface-2 px-2.5 py-1 text-xs font-semibold text-secondary">{entry.type}</span>
            <p className="mt-1 text-sm text-text">
              {entry.type === "ORDER" && `Order ${entry.orderNumber} → ${entry.status}`}
              {entry.type === "NOTE" && `Note (${entry.noteType}): ${entry.body}`}
              {entry.type === "CALL" && `Call: ${entry.outcome}`}
            </p>
          </div>
          <span className="text-xs text-muted">{new Date(entry.occurredAt).toLocaleString()}</span>
        </Card>
      ))}
    </div>
  );
}

export default function CustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const customerId = Number(id);
  const { data: customer, isLoading } = useCustomer(customerId);
  const [tab, setTab] = useState("notes");

  if (isLoading || !customer) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/customers" className="flex items-center gap-1 self-start text-xs font-semibold text-brand-500 hover:underline">
        ← Back to Customers
      </Link>
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          icon={customerIcon}
          title={customer.name}
          subtitle={`${customer.phone ?? "no phone"} · ${customer.email ?? "no email"}`}
          badge={customer.tier ?? undefined}
        />
        <Link href={`/orders/new?customerId=${customer.id}`}>
          <Button type="button" variant="primary">
            New Order
          </Button>
        </Link>
      </div>
      <Card className="flex gap-8">
        <div>
          <p className="text-xs font-semibold text-secondary">Completed Orders</p>
          <p className="num text-lg font-bold text-text">{customer.completedOrderCount}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-secondary">Birthday</p>
          <p className="text-sm text-text">{customer.dob ? new Date(customer.dob).toLocaleDateString() : "—"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-secondary">Customer Since</p>
          <p className="text-sm text-text">{new Date(customer.createdAt).toLocaleDateString()}</p>
        </div>
      </Card>

      <Tabs
        variant="pill"
        options={[
          { value: "notes", label: "Notes" },
          { value: "calls", label: "Call Log" },
          { value: "orders", label: "Order History" },
          { value: "activity", label: "Activity Timeline" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "notes" && <NotesTab customerId={customerId} notes={customer.notes} />}
      {tab === "calls" && <CallLogTab customerId={customerId} calls={customer.callLogs} />}
      {tab === "orders" && <OrderHistoryTab orders={customer.orders} />}
      {tab === "activity" && (
        // Backend's admin-customer.mapper.ts always populates `type` and
        // `occurredAt` on every activity entry (see toAdminCustomerDto) —
        // the generated schema type can't express that beyond
        // `Record<string, unknown>[]` since NestJS Swagger can't reflect
        // the source union type, so this assertion bridges a real,
        // verified-safe gap between the DTO's public type and its actual
        // runtime shape, not a guess.
        <ActivityTab activity={customer.activity as { type: string; occurredAt: string; [key: string]: unknown }[]} />
      )}
    </div>
  );
}
