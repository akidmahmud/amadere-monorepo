"use client";

import { confirmDialog } from "@/components/PosConfirm";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@amader/admin-ui";
import { useToast } from "@/components/ToastProvider";
import { proxyFetch } from "@/lib/api/proxy-client";
import { renderSmsPreview, smsParts } from "@/lib/pos-sms";
import { TierBadge, usePosTiers } from "./PosTiersTab";

type Type = "NOW" | "SCHEDULED" | "RECURRING" | "TIER_UPGRADE" | "WINBACK";
type Campaign = {
  id: number;
  name: string;
  storeId: number | null;
  store: { name: string } | null;
  tierKey: string | null;
  type: Type;
  message: string;
  sendAt: string | null;
  repeat: "DAILY" | "WEEKLY" | "MONTHLY" | null;
  nextRunAt: string | null;
  winbackDays: number | null;
  active: boolean;
  lastRunAt: string | null;
  sentCount: number;
};

const TYPES: { t: Type; label: string; icon: string; help: string }[] = [
  {
    t: "NOW",
    label: "Send now",
    icon: "send",
    help: "Sent right away to the audience.",
  },
  {
    t: "SCHEDULED",
    label: "Scheduled",
    icon: "event",
    help: "Sent once at the date and time you pick.",
  },
  {
    t: "RECURRING",
    label: "Recurring",
    icon: "event_repeat",
    help: "Sent every day / week / month at that time.",
  },
  {
    t: "TIER_UPGRADE",
    label: "Tier upgrade",
    icon: "workspace_premium",
    help: "Sent automatically when a customer reaches the tier at a store — once per tier.",
  },
  {
    t: "WINBACK",
    label: "Win-back",
    icon: "person_search",
    help: "Sent automatically (daily, 11am) to customers who haven't bought for the chosen days — once per absence.",
  },
];
const TYPE_LABEL = Object.fromEntries(
  TYPES.map((x) => [x.t, x.label]),
) as Record<Type, string>;
const TAGS = ["name", "store", "tier", "website"];
const when = (d: string | null) =>
  d
    ? new Date(d).toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
/** datetime-local value (browser time) ↔ ISO. */
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

/**
 * Customer Manager › SMS. `storeId` fixed = this shop's campaigns; `stores`
 * given = pick a store or all stores (admin panel).
 */
export function PosSmsCampaignsTab({
  storeId: fixedStore,
  stores,
}: {
  storeId?: number;
  stores?: { id: number; name: string }[];
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const { data: tiers = [] } = usePosTiers();
  const [editing, setEditing] = useState<Partial<Campaign> | null>(null);
  const list = useQuery({
    queryKey: ["pos-sms-campaigns", fixedStore ?? null],
    queryFn: () =>
      proxyFetch<Campaign[]>(
        `/admin/pos/sms/campaigns${fixedStore ? `?storeId=${fixedStore}` : ""}`,
      ),
  });
  const refresh = () =>
    qc.invalidateQueries({ queryKey: ["pos-sms-campaigns"] });
  const act = useMutation({
    mutationFn: ({
      c,
      action,
    }: {
      c: Campaign;
      action: "send" | "toggle" | "delete";
    }) =>
      action === "send"
        ? proxyFetch<{ sent: number }>(
            `/admin/pos/sms/campaigns/${c.id}/send`,
            { method: "POST" },
          )
        : action === "delete"
          ? proxyFetch(`/admin/pos/sms/campaigns/${c.id}`, { method: "DELETE" })
          : proxyFetch(`/admin/pos/sms/campaigns/${c.id}`, {
              method: "PUT",
              body: JSON.stringify({ ...bodyOf(c), active: !c.active }),
            }),
    onSuccess: (r, { action }) => {
      refresh();
      toast.push(
        action === "send"
          ? `Sent to ${(r as { sent: number }).sent} customer(s)`
          : action === "delete"
            ? "Campaign deleted"
            : "Updated",
        "success",
      );
    },
    onError: (e) => toast.push(e.message),
  });
  const tierName = (k: string | null) => tiers.find((t) => t.key === k);

  return (
    <div className="space-y-4 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">
          Texts go through the website&apos;s SMS gateway (Net Profit › SMS) and
          appear in its SMS log. Tags: {TAGS.map((t) => `{{${t}}}`).join(" ")}
        </p>
        <button
          className="flex h-10 items-center gap-1 rounded-lg bg-[#1d7a46] px-4 text-sm font-bold text-white"
          onClick={() =>
            setEditing({
              type: "NOW",
              storeId: fixedStore ?? null,
              tierKey: null,
              active: true,
              message: "",
            })
          }
        >
          <Icon name="add" size={18} /> New SMS
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-[#1d7a46] text-left text-white">
            <tr>
              <th className="px-4 py-3 font-bold">Campaign</th>
              <th className="px-3 font-bold">Kind</th>
              <th className="px-3 font-bold">Audience</th>
              <th className="px-3 font-bold">When</th>
              <th className="px-3 font-bold">Sent</th>
              <th className="px-3 font-bold">Status</th>
              <th className="px-3" />
            </tr>
          </thead>
          <tbody>
            {(list.isLoading || !list.data?.length) && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  {list.isLoading
                    ? "Loading…"
                    : "No SMS yet. Click “New SMS” to send one or set up an automation."}
                </td>
              </tr>
            )}
            {list.data?.map((c) => {
              const tier = tierName(c.tierKey);
              const done =
                c.type === "NOW" ||
                (c.type === "SCHEDULED" && !c.active && c.lastRunAt);
              return (
                <tr key={c.id} className="border-b border-gray-100">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{c.name}</div>
                    <div className="max-w-xs truncate text-xs text-gray-500">
                      {c.message}
                    </div>
                  </td>
                  <td className="px-3">{TYPE_LABEL[c.type]}</td>
                  <td className="px-3">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-gray-700">
                        {c.store?.name ?? "All stores"}
                      </span>
                      {tier ? (
                        <TierBadge name={tier.name} color={tier.color} />
                      ) : (
                        <span className="text-xs text-gray-500">
                          · everyone
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 text-gray-600">
                    {c.type === "SCHEDULED"
                      ? when(c.sendAt)
                      : c.type === "RECURRING"
                        ? `${c.repeat?.toLowerCase()} · next ${when(c.nextRunAt)}`
                        : c.type === "WINBACK"
                          ? `after ${c.winbackDays} days away`
                          : c.type === "TIER_UPGRADE"
                            ? "on reaching the tier"
                            : when(c.lastRunAt)}
                  </td>
                  <td className="px-3 font-bold">{c.sentCount}</td>
                  <td className="px-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${done ? "bg-gray-100 text-gray-600" : c.active ? "bg-emerald-50 text-[#1d7a46]" : "bg-amber-50 text-amber-800"}`}
                    >
                      {done ? "Sent" : c.active ? "Active" : "Paused"}
                    </span>
                  </td>
                  <td className="px-3">
                    <span className="flex justify-end gap-1">
                      {!done && (
                        <button
                          className="grid h-8 w-8 place-items-center rounded-lg hover:bg-gray-100"
                          onClick={() => act.mutate({ c, action: "toggle" })}
                          title={c.active ? "Pause" : "Resume"}
                          aria-label={
                            c.active ? `Pause ${c.name}` : `Resume ${c.name}`
                          }
                        >
                          <Icon
                            name={c.active ? "pause" : "play_arrow"}
                            size={18}
                          />
                        </button>
                      )}
                      <button
                        className="grid h-8 w-8 place-items-center rounded-lg text-[#1d7a46] hover:bg-emerald-50"
                        onClick={async () =>
                          (await confirmDialog({
                            title: `Send "${c.name}" now?`,
                            message:
                              "It goes to the campaign's current audience straight away.",
                            confirmLabel: "Send now",
                            icon: "send",
                          })) && act.mutate({ c, action: "send" })
                        }
                        title="Send now"
                        aria-label={`Send ${c.name} now`}
                      >
                        <Icon name="send" size={18} />
                      </button>
                      {!done && (
                        <button
                          className="grid h-8 w-8 place-items-center rounded-lg hover:bg-gray-100"
                          onClick={() => setEditing(c)}
                          title="Edit"
                          aria-label={`Edit ${c.name}`}
                        >
                          <Icon name="edit" size={18} />
                        </button>
                      )}
                      <button
                        className="grid h-8 w-8 place-items-center rounded-lg text-red-600 hover:bg-red-50"
                        onClick={async () =>
                          (await confirmDialog({
                            title: `Delete "${c.name}"?`,
                            message:
                              "Automations stop; messages already sent are not affected.",
                            confirmLabel: "Delete",
                            tone: "danger",
                          })) && act.mutate({ c, action: "delete" })
                        }
                        title="Delete"
                        aria-label={`Delete ${c.name}`}
                      >
                        <Icon name="delete" size={18} />
                      </button>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <CampaignDialog
          initial={editing}
          fixedStore={fixedStore}
          stores={stores}
          tiers={tiers}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function bodyOf(c: Partial<Campaign>) {
  return {
    name: c.name ?? "",
    storeId: c.storeId ?? null,
    tierKey: c.tierKey || null,
    type: c.type ?? "NOW",
    message: c.message ?? "",
    sendAt: c.sendAt ?? null,
    repeat: c.type === "RECURRING" ? (c.repeat ?? "WEEKLY") : null,
    winbackDays: c.type === "WINBACK" ? (c.winbackDays ?? 30) : null,
    active: c.active ?? true,
  };
}

function CampaignDialog({
  initial,
  fixedStore,
  stores,
  tiers,
  onClose,
  onSaved,
}: {
  initial: Partial<Campaign>;
  fixedStore?: number;
  stores?: { id: number; name: string }[];
  tiers: { key: string; name: string; color: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [c, setC] = useState<Partial<Campaign>>({
    repeat: "WEEKLY",
    winbackDays: 30,
    ...initial,
  });
  const set = (patch: Partial<Campaign>) => setC((x) => ({ ...x, ...patch }));
  const [reach, setReach] = useState<number | null>(null);
  const body = bodyOf(c);
  const reachKey = JSON.stringify([
    body.storeId,
    body.tierKey,
    body.type,
    body.winbackDays,
  ]);
  useEffect(() => {
    let live = true;
    proxyFetch<{ count: number }>("/admin/pos/sms/campaigns/preview", {
      method: "POST",
      body: JSON.stringify({
        storeId: body.storeId,
        tierKey: body.tierKey,
        type: body.type,
        winbackDays: body.winbackDays,
      }),
    })
      .then((r) => live && setReach(r.count))
      .catch(() => live && setReach(null));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reachKey]);
  const save = useMutation({
    mutationFn: () =>
      proxyFetch<{ sent?: number }>(
        initial.id
          ? `/admin/pos/sms/campaigns/${initial.id}`
          : "/admin/pos/sms/campaigns",
        { method: initial.id ? "PUT" : "POST", body: JSON.stringify(body) },
      ),
    onSuccess: (r) => {
      toast.push(
        body.type === "NOW" && !initial.id
          ? `Sent to ${r.sent ?? 0} customer(s)`
          : "Saved",
        "success",
      );
      onSaved();
    },
    onError: (e) => toast.push(e.message),
  });
  const preview = renderSmsPreview(body.message, {
    name: "Karim",
    store: stores?.find((s) => s.id === body.storeId)?.name ?? "Uttara",
    tier: tiers.find((t) => t.key === body.tierKey)?.name ?? "Gold",
    website: "https://amadere.com",
  });
  const parts = smsParts(preview);
  const needsTime = body.type === "SCHEDULED" || body.type === "RECURRING";
  const valid =
    body.name.trim() &&
    body.message.trim() &&
    (!needsTime || body.sendAt) &&
    (body.type !== "WINBACK" || (body.winbackDays ?? 0) >= 1);
  const field =
    "h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#1d7a46]";

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="SMS campaign"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">
            {initial.id ? "Edit SMS" : "New SMS"}
          </h2>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg hover:bg-gray-100"
            aria-label="Close"
          >
            <Icon name="close" size={22} />
          </button>
        </div>
        <div className="space-y-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold">Name (for you)</span>
            <input
              className={field}
              value={c.name ?? ""}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="e.g. Eid offer for Gold"
            />
          </label>

          <div>
            <span className="text-xs font-bold">Kind</span>
            <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {TYPES.map((x) => (
                <button
                  key={x.t}
                  type="button"
                  disabled={!!initial.id}
                  onClick={() => set({ type: x.t })}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 text-xs font-bold disabled:opacity-60 ${c.type === x.t ? "border-[#1d7a46] bg-emerald-50 text-[#1d7a46]" : "border-gray-200 text-gray-700"}`}
                >
                  <Icon name={x.icon} size={22} />
                  {x.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {TYPES.find((x) => x.t === c.type)?.help}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold">Store</span>
              {fixedStore ? (
                <input className={field} disabled value="This store" />
              ) : (
                <select
                  className={field}
                  value={c.storeId ?? ""}
                  onChange={(e) =>
                    set({
                      storeId: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                >
                  <option value="">All stores</option>
                  {stores?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold">
                {c.type === "TIER_UPGRADE" ? "When they reach" : "Customers"}
              </span>
              <select
                className={field}
                value={c.tierKey ?? ""}
                onChange={(e) => set({ tierKey: e.target.value || null })}
              >
                <option value="">
                  {c.type === "TIER_UPGRADE" ? "Any higher tier" : "Everyone"}
                </option>
                {tiers.map((t) => (
                  <option key={t.key} value={t.key}>
                    {c.type === "TIER_UPGRADE" ? t.name : `${t.name} tier only`}
                  </option>
                ))}
              </select>
            </label>
            {needsTime && (
              <label className="flex flex-col gap-1">
                <span className="text-xs font-bold">
                  {c.type === "RECURRING" ? "First send" : "Send at"}
                </span>
                <input
                  type="datetime-local"
                  className={field}
                  value={toLocalInput(c.sendAt ?? null)}
                  onChange={(e) =>
                    set({
                      sendAt: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null,
                    })
                  }
                />
              </label>
            )}
            {c.type === "RECURRING" && (
              <label className="flex flex-col gap-1">
                <span className="text-xs font-bold">Repeat</span>
                <select
                  className={field}
                  value={c.repeat ?? "WEEKLY"}
                  onChange={(e) =>
                    set({ repeat: e.target.value as Campaign["repeat"] })
                  }
                >
                  <option value="DAILY">Every day</option>
                  <option value="WEEKLY">Every week</option>
                  <option value="MONTHLY">Every month</option>
                </select>
              </label>
            )}
            {c.type === "WINBACK" && (
              <label className="flex flex-col gap-1">
                <span className="text-xs font-bold">
                  No purchase for (days)
                </span>
                <input
                  className={field}
                  inputMode="numeric"
                  value={c.winbackDays ?? ""}
                  onChange={(e) =>
                    set({
                      winbackDays:
                        Number(e.target.value.replace(/\D/g, "")) || null,
                    })
                  }
                />
              </label>
            )}
          </div>

          <div>
            <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-bold">Message</span>
              {TAGS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set({ message: `${c.message ?? ""}{{${t}}}` })}
                  className="rounded-full bg-emerald-50 px-2.5 py-1 font-mono font-semibold text-[#1d7a46] hover:bg-emerald-100"
                >
                  {`{{${t}}}`}
                </button>
              ))}
            </div>
            <textarea
              rows={4}
              maxLength={612}
              value={c.message ?? ""}
              onChange={(e) => set({ message: e.target.value })}
              aria-label="Message"
              placeholder="e.g. Dear {{name}}, enjoy 10% off this week at {{store}}! {{website}}"
              className="w-full rounded-lg border border-gray-200 p-3 text-sm outline-none focus:border-[#1d7a46]"
            />
            <div className="mt-1 rounded-lg bg-gray-50 p-2.5 text-sm">
              <div className="mb-0.5 flex justify-between text-xs text-gray-500">
                <span>Preview</span>
                <span>
                  {parts.chars} chars · {parts.parts} SMS
                  {parts.unicode ? " (Bangla: 70 per SMS)" : ""}
                </span>
              </div>
              <p className="whitespace-pre-wrap">{preview || "—"}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-bold text-[#1d7a46]">
              <Icon name="groups" size={18} />
              {reach === null
                ? "…"
                : `Reaches ${reach} customer${reach === 1 ? "" : "s"} now`}
            </span>
            <span className="ml-auto flex gap-2">
              <button
                className="h-10 rounded-lg border border-gray-200 px-4 text-sm font-semibold"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="flex h-10 items-center gap-1 rounded-lg bg-[#1d7a46] px-5 text-sm font-bold text-white disabled:opacity-50"
                disabled={!valid || save.isPending}
                onClick={async () =>
                  (body.type !== "NOW" ||
                    initial.id ||
                    (await confirmDialog({
                      title: `Send to ${reach ?? "the"} customer${reach === 1 ? "" : "s"} now?`,
                      message: "SMS can't be taken back once sent.",
                      confirmLabel: "Send now",
                      icon: "send",
                    }))) &&
                  save.mutate()
                }
              >
                <Icon
                  name={body.type === "NOW" && !initial.id ? "send" : "save"}
                  size={18}
                />
                {save.isPending
                  ? "Working…"
                  : body.type === "NOW" && !initial.id
                    ? "Send now"
                    : "Save"}
              </button>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
