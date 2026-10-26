"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Button, Icon, Modal } from "@amader/admin-ui";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BD_ALL_DISTRICTS } from "@amader/shared";
import { useCan } from "@/hooks/useAdminAuth";
import { useAssignableStaff } from "@/hooks/useCustomers";
import {
  LEAD_OUTCOME_LABEL,
  LEAD_SOURCES,
  LEAD_STATUS_LABEL,
  LOST_REASONS,
  useLead,
  useLogLeadCall,
  useUpdateLead,
  type LeadCallOutcome,
  type LeadDetail,
  type LeadInput,
} from "@/hooks/useLeads";

const GREEN = "#2e7d43";
const day = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString("en-GB") : null);
const moment = (v: string) => new Date(v).toLocaleString("en-GB");
const isoDay = (v: string | null | undefined) => (v ? v.slice(0, 10) : "");
const local = (p: string) => (p.startsWith("880") ? `0${p.slice(3)}` : p);

function Field({ label, children }: { label: string; children?: ReactNode }) {
  const empty = children === null || children === undefined || children === "";
  return (
    <div className="min-w-0">
      <dt className="text-[0.68rem] font-bold uppercase tracking-wide text-muted">{label}</dt>
      <dd className={`mt-0.5 break-words text-sm ${empty ? "text-muted" : "text-text"}`}>{empty ? "—" : children}</dd>
    </div>
  );
}

// ---- Card definitions: what each card shows and edits --------------------

type Key = keyof LeadInput;
type Input =
  | { key: Key; label: string; type: "text" | "tel" | "email" | "date" | "textarea" }
  | { key: Key; label: string; type: "select"; options: { value: string; label: string }[] }
  | { key: Key; label: string; type: "staff" }
  | { key: Key; label: string; type: "list"; options: string[] };

type CardKey = "lead" | "personal" | "address" | "crm" | "followup" | "person";
const opts = (o: Record<string, string>) => Object.entries(o).map(([value, label]) => ({ value, label }));

const CARDS: Record<CardKey, { title: string; inputs: Input[] }> = {
  lead: {
    title: "Lead",
    inputs: [
      { key: "leadSource", label: "Lead source", type: "list", options: LEAD_SOURCES },
      { key: "leadDate", label: "Lead date", type: "date" },
      { key: "interestedProduct", label: "Interested product", type: "text" },
      { key: "status", label: "Status", type: "select", options: opts(LEAD_STATUS_LABEL).filter((o) => o.value !== "CONVERTED") },
      { key: "lostReason", label: "Lost reason", type: "list", options: LOST_REASONS },
    ],
  },
  personal: {
    title: "Personal",
    inputs: [
      { key: "name", label: "Full name", type: "text" },
      { key: "phone", label: "Phone", type: "tel" },
      { key: "altPhone", label: "Alt. phone", type: "tel" },
      { key: "email", label: "Email", type: "email" },
    ],
  },
  address: {
    title: "Address",
    inputs: [
      { key: "addressLine", label: "Address", type: "text" },
      { key: "district", label: "District", type: "list", options: BD_ALL_DISTRICTS },
      { key: "area", label: "Area / thana", type: "text" },
    ],
  },
  crm: {
    title: "CRM",
    inputs: [
      { key: "assignedAdminId", label: "Assigned to", type: "staff" },
      { key: "priority", label: "Priority", type: "select", options: opts({ HIGH: "High", MEDIUM: "Medium", LOW: "Low" }) },
    ],
  },
  followup: {
    title: "Follow-up",
    inputs: [{ key: "nextCallDate", label: "Next call date", type: "date" }],
  },
  person: {
    title: "Notes on the person",
    inputs: [
      { key: "customerFeedback", label: "Customer feedback", type: "textarea" },
      { key: "agentFeedback", label: "Agent feedback", type: "textarea" },
      { key: "familyDetails", label: "Family details", type: "textarea" },
      { key: "purchaseReason", label: "Reason for purchase", type: "textarea" },
    ],
  },
};
const DEFAULT_ORDER = Object.keys(CARDS) as CardKey[];
const ORDER_STORAGE = "lead-modal-card-order";

function loadOrder(): CardKey[] {
  try {
    const saved = (JSON.parse(localStorage.getItem(ORDER_STORAGE) ?? "[]") as CardKey[]).filter((k) => k in CARDS);
    return [...saved, ...DEFAULT_ORDER.filter((k) => !saved.includes(k))];
  } catch {
    return DEFAULT_ORDER;
  }
}

const fieldCls =
  "w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm text-text outline-none transition-colors hover:border-border hover:bg-surface focus:border-[#2e7d43] focus:bg-surface disabled:cursor-default disabled:hover:border-transparent disabled:hover:bg-transparent";

const valueOf = (lead: LeadDetail, i: Input) => {
  const v = lead[i.key as keyof LeadDetail];
  if (i.key === "phone") return local(lead.phone);
  if (i.type === "date") return isoDay(v as string | null);
  return v === null || v === undefined ? "" : String(v);
};

/**
 * One field, edited where it sits: click and type, it saves when you leave
 * the field (or press Enter); dropdowns and dates save as soon as you pick.
 */
function InlineField({ lead, input: i, canEdit }: { lead: LeadDetail; input: Input; canEdit: boolean }) {
  const update = useUpdateLead(lead.id);
  const { data: staff } = useAssignableStaff();
  const saved = valueOf(lead, i);
  const [v, setV] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setV(saved), [saved]);

  function commit(next = v) {
    const t = next.trim();
    if (t === saved) return;
    setError(null);
    const value = i.type === "staff" ? (t ? Number(t) : null) : i.key === "phone" ? t : t || null;
    update.mutate({ [i.key]: value } as LeadInput, {
      onError: (e) => {
        setError(e instanceof Error ? e.message : "Save failed");
        setV(saved);
      },
    });
  }
  const pick = (next: string) => {
    setV(next);
    commit(next);
  };
  const enter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && i.type !== "textarea") (e.target as HTMLElement).blur();
    if (e.key === "Escape") setV(saved);
  };
  const common = { disabled: !canEdit, className: fieldCls, "aria-label": i.label };

  let control: ReactNode;
  if (i.type === "textarea")
    control = <textarea {...common} rows={2} value={v} placeholder={canEdit ? "Click to add…" : "—"} onChange={(e) => setV(e.target.value)} onBlur={() => commit()} onKeyDown={enter} />;
  else if (i.type === "select" || i.type === "staff")
    control = (
      <select {...common} value={v} onChange={(e) => pick(e.target.value)}>
        <option value="">{i.type === "staff" ? "Unassigned" : "—"}</option>
        {(i.type === "staff" ? (staff ?? []).map((s) => ({ value: String(s.id), label: s.name })) : i.options).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  else if (i.type === "date") control = <input {...common} type="date" value={v} onChange={(e) => pick(e.target.value)} />;
  else
    control = (
      <>
        <input
          {...common}
          type={i.type === "list" ? "text" : i.type}
          list={i.type === "list" ? `lead-${lead.id}-${i.key}` : undefined}
          value={v}
          placeholder={canEdit ? "Click to add…" : "—"}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => commit()}
          onKeyDown={enter}
        />
        {i.type === "list" && (
          <datalist id={`lead-${lead.id}-${i.key}`}>
            {i.options.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        )}
      </>
    );

  return (
    <label className={`flex min-w-0 flex-col gap-0.5 ${i.type === "textarea" ? "sm:col-span-3" : ""}`}>
      <span className="flex items-center gap-1.5 px-2 text-[0.68rem] font-bold uppercase tracking-wide text-muted">
        {i.label}
        {update.isPending && <span className="font-semibold normal-case text-muted">saving…</span>}
        {update.isSuccess && !update.isPending && !error && <span className="font-semibold normal-case" style={{ color: GREEN }}>saved</span>}
      </span>
      {control}
      {error && <span className="px-2 text-xs font-semibold text-rose-600">{error}</span>}
    </label>
  );
}

/** A card's fields, all editable in place. */
function CardFields({ lead, card, canEdit }: { lead: LeadDetail; card: CardKey; canEdit: boolean }) {
  const daysLeft = lead.nextCallDate ? Math.ceil((new Date(lead.nextCallDate).getTime() - Date.now()) / 86_400_000) : null;
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-3">
      {CARDS[card].inputs.map((i) => (
        <InlineField key={i.key} lead={lead} input={i} canEdit={canEdit} />
      ))}
      {card === "followup" && (
        <>
          <div className="px-2">
            <Field label="Days left">{daysLeft}</Field>
          </div>
          <div className="px-2">
            <Field label="Last call">{lead.lastCallAt ? moment(lead.lastCallAt) : null}</Field>
          </div>
          <div className="px-2">
            <Field label="Calls made">{lead.calls.length}</Field>
          </div>
        </>
      )}
    </dl>
  );
}

function Card({ id, lead, canEdit, draggable = true }: { id: CardKey; lead: LeadDetail; canEdit: boolean; draggable?: boolean }) {
  const sortable = useSortable({ id, disabled: !draggable });
  return (
    <section
      ref={sortable.setNodeRef}
      id={`lead-card-${id}`}
      style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }}
      className={`scroll-mt-28 rounded-xl border border-border bg-surface-2/40 p-4 ${sortable.isDragging ? "relative z-10 shadow-lg" : ""}`}
    >
      <div className="mb-2 flex items-center gap-2">
        {draggable && (
          <button
            type="button"
            {...sortable.attributes}
            {...sortable.listeners}
            aria-label={`Drag ${CARDS[id].title}`}
            title="Drag to reorder"
            className="cursor-grab touch-none rounded p-0.5 text-muted hover:bg-surface-2 hover:text-text active:cursor-grabbing"
          >
            <Icon name="drag_indicator" size={16} />
          </button>
        )}
        <h4 className="flex-1 text-[0.72rem] font-bold uppercase tracking-wide text-secondary">{CARDS[id].title}</h4>
      </div>
      <CardFields lead={lead} card={id} canEdit={canEdit} />
    </section>
  );
}

/** Always-visible call bar: Call (dials), then log what happened. */
function CallBar({ lead }: { lead: LeadDetail }) {
  const log = useLogLeadCall(lead.id);
  const [outcome, setOutcome] = useState<LeadCallOutcome | "">("");
  const [notes, setNotes] = useState("");
  return (
    <div className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center gap-2 rounded-xl border border-[#2e7d43]/25 bg-[#f2f8f3] p-3 shadow-sm dark:bg-surface-2">
      <a
        href={`tel:${local(lead.phone)}`}
        className="inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-extrabold text-white"
        style={{ background: GREEN }}
      >
        <Icon name="call" size={18} />
        Call {local(lead.phone)}
      </a>
      <select
        value={outcome}
        onChange={(e) => setOutcome(e.target.value as LeadCallOutcome)}
        className="h-10 rounded-lg border border-border bg-surface px-2.5 text-sm"
        aria-label="Call outcome"
      >
        <option value="">What happened?</option>
        {Object.entries(LEAD_OUTCOME_LABEL).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Call note (optional)"
        className="h-10 min-w-[160px] flex-1 rounded-lg border border-border bg-surface px-2.5 text-sm"
      />
      <button
        type="button"
        disabled={!outcome || log.isPending}
        onClick={() =>
          outcome &&
          log.mutate(
            { outcome, notes: notes || undefined },
            {
              onSuccess: () => {
                setOutcome("");
                setNotes("");
              },
            },
          )
        }
        className="h-10 rounded-lg border px-3.5 text-sm font-bold disabled:opacity-40"
        style={{ borderColor: GREEN, color: GREEN }}
      >
        {log.isPending ? "Saving…" : "Log call"}
      </button>
      {log.isError && <p className="w-full text-xs font-semibold text-rose-600">{(log.error as Error).message}</p>}
    </div>
  );
}

function Overview({ lead, canEdit }: { lead: LeadDetail; canEdit: boolean }) {
  const [order, setOrder] = useState<CardKey[]>(loadOrder);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  function onDragEnd(e: DragEndEvent) {
    const from = order.indexOf(e.active.id as CardKey);
    const to = e.over ? order.indexOf(e.over.id as CardKey) : -1;
    if (from < 0 || to < 0 || from === to) return;
    const next = arrayMove(order, from, to);
    setOrder(next);
    try {
      localStorage.setItem(ORDER_STORAGE, JSON.stringify(next));
    } catch {
      /* not remembered in private mode */
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {order.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => document.getElementById(`lead-card-${k}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="rounded-pill border border-border bg-surface px-3 py-1 text-xs font-semibold text-secondary hover:border-[#2e7d43] hover:text-[#2e7d43]"
          >
            {CARDS[k].title}
          </button>
        ))}
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          {order.map((k) => (
            <Card key={k} id={k} lead={lead} canEdit={canEdit} />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

function CallsTab({ lead }: { lead: LeadDetail }) {
  if (!lead.calls.length) return <p className="py-10 text-center text-sm text-muted">No calls logged yet. Use the call bar above.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {lead.calls.map((c) => (
        <li key={c.id} className="rounded-xl border border-border bg-surface-2/40 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-pill bg-[#2e7d43]/10 px-2.5 py-0.5 text-[0.7rem] font-bold" style={{ color: GREEN }}>
              {LEAD_OUTCOME_LABEL[c.outcome]}
            </span>
            <span className="text-sm font-semibold text-secondary">{moment(c.createdAt)}</span>
          </div>
          {c.notes && <p className="mt-1.5 text-sm text-text">{c.notes}</p>}
          {c.authorName && <p className="mt-1 text-xs text-muted">by {c.authorName}</p>}
        </li>
      ))}
    </ul>
  );
}

/**
 * A lead, worked on while on the phone: the call bar stays at the top, every
 * card is editable on its own, and New Order turns the lead into a customer
 * (the order converts it — see LeadsService.onOrderCreated).
 */
export function LeadDetailModal({ leadId, onClose }: { leadId: number; onClose: () => void }) {
  const { data: lead, isLoading, error, refetch, isFetching } = useLead(leadId);
  const canEdit = useCan("customer.manage");
  const [tab, setTab] = useState<"overview" | "calls" | "person">("overview");
  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "calls", label: `Calls${lead?.calls.length ? ` ${lead.calls.length}` : ""}` },
    { key: "person", label: "Notes on the person" },
  ] as const;
  return (
    <Modal open onClose={onClose} title={lead ? lead.name || local(lead.phone) : "Lead"} tone="dark" className="max-w-5xl">
      {error && !lead ? (
        // Don't spin forever when the server can't be reached.
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm font-semibold text-rose-600">Couldn't load this lead: {(error as Error).message}</p>
          <button
            type="button"
            disabled={isFetching}
            onClick={() => void refetch()}
            className="h-9 rounded-lg border px-3.5 text-sm font-bold disabled:opacity-50"
            style={{ borderColor: GREEN, color: GREEN }}
          >
            {isFetching ? "Retrying…" : "Retry"}
          </button>
        </div>
      ) : isLoading || !lead ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <CallBar lead={lead} />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-pill bg-[#2e7d43]/10 px-2.5 py-0.5 text-[0.72rem] font-bold" style={{ color: GREEN }}>
              {LEAD_STATUS_LABEL[lead.status]}
            </span>
            {lead.leadSource && <span className="text-secondary">from {lead.leadSource}</span>}
            {lead.interestedProduct && <span className="text-secondary">· wants {lead.interestedProduct}</span>}
          </div>
          <div className="flex flex-wrap gap-1.5 border-b border-border">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`-mb-px border-b-2 px-3.5 py-2 text-sm font-semibold ${tab === t.key ? "" : "border-transparent text-secondary hover:text-text"}`}
                style={tab === t.key ? { borderColor: GREEN, color: GREEN } : undefined}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="min-h-[240px]">
            {tab === "overview" && <Overview lead={lead} canEdit={canEdit} />}
            {tab === "calls" && <CallsTab lead={lead} />}
            {tab === "person" && (
              <DndContext>
                <SortableContext items={["person"]}>
                  <Card id="person" lead={lead} canEdit={canEdit} draggable={false} />
                </SortableContext>
              </DndContext>
            )}
          </div>
          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <Link href={`/orders/new?leadId=${lead.id}`}>
              <button type="button" className="h-10 rounded-lg px-4 text-sm font-bold text-white" style={{ background: GREEN }}>
                New Order
              </button>
            </Link>
            <Button type="button" variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
