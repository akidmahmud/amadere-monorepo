"use client";

import { useState } from "react";
import { Button, Card, Icon, Tabs } from "@amader/admin-ui";
import {
  useCustomerCampaignSettings,
  useUpdateCustomerCampaignSettings,
  useCustomerCampaignTemplates,
  useUpsertCustomerCampaignTemplate,
  useDeleteCustomerCampaignTemplate,
  useCustomerCampaignQueue,
  useCancelCustomerCampaignQueueItem,
  useSendCustomerCampaignNow,
  type CustomerCampaignTemplate,
} from "@/hooks/useCustomerCampaigns";

const input =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

const STATUS_COLOR: Record<string, string> = {
  PENDING: "#b45309",
  SENT: "#1e7439",
  FAILED: "#d0555f",
  SKIPPED: "#6b7280",
};

function blankTemplate(): Partial<CustomerCampaignTemplate> {
  return {
    channel: "EMAIL",
    name: "",
    subject: "",
    bodyEn: "",
    bodyBn: "",
    bodyHtmlEn: "",
    bodyHtmlBn: "",
    trigger: "CUSTOMER_ADDED",
    audience: "ALL",
    audienceDays: 30,
    repeatEveryDays: 30,
    delayValue: 0,
    delayUnit: "MINUTE",
    status: "ACTIVE",
  };
}

/**
 * Welcome messages sent to a customer after they are added — by email, SMS,
 * or both.
 *
 * Distinct from Newsletter Campaigns next door: that one blasts a one-off to
 * newsletter subscribers, this one runs automatically per customer on a
 * delay, and reaches people who ordered without ever ticking the newsletter
 * box.
 */
export default function CustomerCampaignsPage() {
  const [tab, setTab] = useState("templates");
  const { data: settings } = useCustomerCampaignSettings();
  const updateSettings = useUpdateCustomerCampaignSettings();
  const { data: templates, isLoading } = useCustomerCampaignTemplates();
  const upsert = useUpsertCustomerCampaignTemplate();
  const remove = useDeleteCustomerCampaignTemplate();
  const { data: queue } = useCustomerCampaignQueue();
  const cancel = useCancelCustomerCampaignQueueItem();
  const sendNow = useSendCustomerCampaignNow();

  const [draft, setDraft] = useState<(Partial<CustomerCampaignTemplate> & { id?: number }) | null>(null);

  function save() {
    if (!draft?.name || !draft.bodyEn) return;
    upsert.mutate(
      { ...draft, bodyBn: draft.bodyBn || draft.bodyEn },
      { onSuccess: () => setDraft(null) },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[1.45rem] font-extrabold tracking-tight text-text">Customer Campaigns</h1>
        <p className="mt-1 text-sm text-muted">
          Automatic welcome messages when a customer is added — email, SMS, or both.
        </p>
      </div>

      {/* The master switch first, because nothing below it does anything
          until this is on, and that is the single most confusing thing about
          an engine like this. */}
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex items-start gap-3">
          <Icon
            name={settings?.enabled ? "toggle_on" : "toggle_off"}
            className={settings?.enabled ? "text-brand-500" : "text-muted"}
            size={26}
          />
          <div>
            <p className="text-sm font-bold text-text">
              {settings?.enabled ? "Campaigns are running" : "Campaigns are off"}
            </p>
            <p className="max-w-2xl text-xs text-muted">
              {settings?.enabled
                ? "New customers are enrolled automatically and messages send on schedule."
                : "Nothing is queued and nothing is sent. Add your templates first, then switch this on."}
              {" "}Quiet hours: {settings?.quietHoursStart ?? 22}:00–{settings?.quietHoursEnd ?? 8}:00 (nothing sends).
            </p>
          </div>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand-500"
            checked={settings?.enabled ?? false}
            onChange={(e) => updateSettings.mutate({ enabled: e.target.checked })}
          />
          <span className="text-sm font-semibold text-text">{settings?.enabled ? "On" : "Off"}</span>
        </label>
      </Card>

      <Tabs
        options={[
          { value: "templates", label: "Templates" },
          { value: "queue", label: "Queue" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "templates" && (
        <div className="flex flex-col gap-4">
          <div>
            <Button onClick={() => setDraft(blankTemplate())}>Add message</Button>
          </div>

          {isLoading && <Card className="p-6 text-sm text-muted">Loading…</Card>}

          {templates?.length === 0 && !draft && (
            <Card className="p-6 text-sm text-muted">
              No messages yet. Add one, then switch the engine on.
            </Card>
          )}

          {draft && (
            <Card className="flex flex-col gap-3 p-5">
              <div className="grid gap-3 md:grid-cols-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-text">Channel</span>
                  <select
                    className={input}
                    value={draft.channel}
                    onChange={(e) => setDraft({ ...draft, channel: e.target.value as "EMAIL" | "SMS" })}
                  >
                    <option value="EMAIL">Email</option>
                    <option value="SMS">SMS</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 md:col-span-2">
                  <span className="text-xs font-semibold text-text">Name (internal)</span>
                  <input
                    className={input}
                    value={draft.name ?? ""}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="Welcome email"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <label className="flex w-52 flex-col gap-1">
                  <span className="text-xs font-semibold text-text">When to send</span>
                  <select
                    className={input}
                    value={draft.trigger}
                    onChange={(e) =>
                      setDraft({ ...draft, trigger: e.target.value as "CUSTOMER_ADDED" | "RECURRING" })
                    }
                  >
                    <option value="CUSTOMER_ADDED">Once, when a customer is added</option>
                    <option value="RECURRING">Repeatedly, on a schedule</option>
                  </select>
                </label>
                {draft.trigger === "RECURRING" && (
                  <>
                    <label className="flex w-56 flex-col gap-1">
                      <span className="text-xs font-semibold text-text">Who</span>
                      <select
                        className={input}
                        value={draft.audience}
                        onChange={(e) =>
                          setDraft({ ...draft, audience: e.target.value as "ALL" | "NO_ORDER_IN_DAYS" })
                        }
                      >
                        <option value="ALL">Every customer</option>
                        <option value="NO_ORDER_IN_DAYS">Customers who have not ordered</option>
                      </select>
                    </label>
                    {draft.audience === "NO_ORDER_IN_DAYS" && (
                      <label className="flex w-32 flex-col gap-1">
                        <span className="text-xs font-semibold text-text">in the last (days)</span>
                        <input
                          type="number"
                          min={1}
                          className={input}
                          value={draft.audienceDays ?? 30}
                          onChange={(e) => setDraft({ ...draft, audienceDays: Number(e.target.value) })}
                        />
                      </label>
                    )}
                    {/* The guard that stops a recurring campaign becoming a
                        daily one for the same person. */}
                    <label className="flex w-40 flex-col gap-1">
                      <span className="text-xs font-semibold text-text">Not again within (days)</span>
                      <input
                        type="number"
                        min={1}
                        className={input}
                        value={draft.repeatEveryDays ?? 30}
                        onChange={(e) => setDraft({ ...draft, repeatEveryDays: Number(e.target.value) })}
                      />
                    </label>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <label className="flex w-32 flex-col gap-1">
                  <span className="text-xs font-semibold text-text">Send after</span>
                  <input
                    type="number"
                    min={0}
                    className={input}
                    value={draft.delayValue ?? 0}
                    onChange={(e) => setDraft({ ...draft, delayValue: Number(e.target.value) })}
                  />
                </label>
                <label className="flex w-36 flex-col gap-1">
                  <span className="text-xs font-semibold text-text">&nbsp;</span>
                  <select
                    className={input}
                    value={draft.delayUnit}
                    onChange={(e) =>
                      setDraft({ ...draft, delayUnit: e.target.value as "MINUTE" | "HOUR" | "DAY" })
                    }
                  >
                    <option value="MINUTE">minutes</option>
                    <option value="HOUR">hours</option>
                    <option value="DAY">days</option>
                  </select>
                </label>
                <span className="pb-2.5 text-xs text-muted">
                  {draft.trigger === "RECURRING"
                    ? "after each scan picks the customer up (0 = immediately)"
                    : "after the customer is added (0 = immediately)"}
                </span>
              </div>

              {draft.channel === "EMAIL" && (
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-text">Subject</span>
                  <input
                    className={input}
                    value={draft.subject ?? ""}
                    onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                  />
                </label>
              )}

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-text">
                  Message (English) — use {"{{first_name}}"} or {"{{name}}"}
                </span>
                <textarea
                  rows={3}
                  className={input}
                  value={draft.bodyEn ?? ""}
                  onChange={(e) => setDraft({ ...draft, bodyEn: e.target.value })}
                  placeholder="Hi {{first_name}}, welcome to Amader™!"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-text">
                  Message (বাংলা) — falls back to English if left empty
                </span>
                <textarea
                  rows={3}
                  className={input}
                  value={draft.bodyBn ?? ""}
                  onChange={(e) => setDraft({ ...draft, bodyBn: e.target.value })}
                />
              </label>

              {/* HTML is email-only; an SMS has nowhere to render it. */}
              {draft.channel === "EMAIL" && (
                <>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-text">
                      HTML email (optional) — paste a full template here
                    </span>
                    <textarea
                      rows={8}
                      className={`${input} font-mono text-xs`}
                      value={draft.bodyHtmlEn ?? ""}
                      onChange={(e) => setDraft({ ...draft, bodyHtmlEn: e.target.value })}
                      placeholder="<div>Hi {{first_name}} ...</div>"
                    />
                    <span className="text-[11px] text-muted">
                      The plain message above is still sent alongside it, for clients that
                      block HTML. Merge tags work in both.
                    </span>
                  </label>
                  {draft.bodyHtmlEn?.trim() && (
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-text">Preview</span>
                      {/* Sandboxed: pasted HTML is not trusted to run scripts
                          inside the admin. */}
                      <iframe
                        title="Email preview"
                        sandbox=""
                        srcDoc={draft.bodyHtmlEn}
                        className="h-64 w-full rounded-md border border-border bg-white"
                      />
                    </div>
                  )}
                </>
              )}

              <div className="flex items-center gap-2">
                <Button onClick={save} disabled={upsert.isPending || !draft.name || !draft.bodyEn}>
                  {upsert.isPending ? "Saving…" : "Save"}
                </Button>
                <Button variant="ghost" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
              </div>
            </Card>
          )}

          {templates?.map((t) => (
            <Card key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-bold text-text">
                  {t.name}{" "}
                  <span className="ml-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-muted">
                    {t.channel === "SMS" ? "SMS" : "Email"}
                  </span>
                  {t.status === "PAUSED" && (
                    <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                      Paused
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {t.trigger === "RECURRING"
                    ? `Recurring · ${t.audience === "ALL" ? "every customer" : `no order in ${t.audienceDays ?? 30}d`} · not again within ${t.repeatEveryDays ?? 30}d · `
                    : ""}
                  {t.delayValue === 0
                    ? "Immediately"
                    : `${t.delayValue} ${t.delayUnit.toLowerCase()}${t.delayValue === 1 ? "" : "s"}`}{" "}
                  after the customer is added · {t.bodyEn.slice(0, 70)}
                  {t.bodyEn.length > 70 ? "…" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() =>
                    upsert.mutate({ id: t.id, status: t.status === "ACTIVE" ? "PAUSED" : "ACTIVE" })
                  }
                >
                  {t.status === "ACTIVE" ? "Pause" : "Resume"}
                </Button>
                <Button variant="ghost" onClick={() => setDraft(t)}>
                  Edit
                </Button>
                <Button variant="ghost" onClick={() => remove.mutate(t.id)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "queue" && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="bg-surface-2 text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Message</th>
                <th className="px-3 py-2">Channel</th>
                <th className="px-3 py-2">To</th>
                <th className="px-3 py-2">Scheduled</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {(queue ?? []).length === 0 && (
                <tr>
                  <td className="px-3 py-6 text-center text-muted" colSpan={7}>
                    Nothing queued yet.
                  </td>
                </tr>
              )}
              {queue?.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2 text-text">#{r.customerId}</td>
                  <td className="px-3 py-2 text-text">{r.template.name}</td>
                  <td className="px-3 py-2 text-muted">{r.channel === "SMS" ? "SMS" : "Email"}</td>
                  <td className="px-3 py-2 text-muted">{r.recipient ?? "—"}</td>
                  <td className="px-3 py-2 text-muted">{r.scheduledAt.slice(0, 16).replace("T", " ")}</td>
                  <td className="px-3 py-2">
                    <span className="font-semibold" style={{ color: STATUS_COLOR[r.status] }}>
                      {r.status}
                    </span>
                    {r.lastError && <p className="text-[11px] text-red-600">{r.lastError}</p>}
                  </td>
                  <td className="px-3 py-2">
                    {r.status === "PENDING" && (
                      <div className="flex gap-1.5">
                        <Button variant="ghost" onClick={() => sendNow.mutate(r.id)}>
                          Send now
                        </Button>
                        <Button variant="ghost" onClick={() => cancel.mutate(r.id)}>
                          Cancel
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
