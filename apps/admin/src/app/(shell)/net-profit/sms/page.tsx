"use client";

import { useState } from "react";
import { Button, Card, Icon, PageHeader, SettingsCard, Table, TableEmptyRow, Tabs, ToggleSwitch } from "@amader/admin-ui";
import {
  TEMPLATE_PLACEHOLDERS,
  useBulkSendSms,
  useSmsBalance,
  useSmsLogs,
  useSmsSettings,
  useSmsTemplates,
  useTestSendSms,
  useClearSmsApiKey,
  useClearSmsSecretKey,
  useUpdateSmsSettings,
  useUpdateSmsTemplate,
} from "@/hooks/useSms";
import { useOtpSecuritySettings, useUpdateOtpSecuritySettings, type VpnPolicy } from "@/hooks/useOtpSecurity";
import { useGeneratePushKeys, usePushSettings, useUpdatePushSettings } from "@/hooks/usePush";

const smsIcon = <Icon name="sms" />;

const STATUS_TRIGGER_LABELS: { key: "CONFIRMED" | "PROCESSING" | "COMPLETED"; template: string; label: string }[] = [
  { key: "CONFIRMED", template: "order_confirmed", label: "Order confirmed" },
  { key: "PROCESSING", template: "order_shipped", label: "Order shipped (processing)" },
  { key: "COMPLETED", template: "order_delivered", label: "Order delivered (completed)" },
];

function TemplatesTab() {
  const { data: templates, isLoading } = useSmsTemplates();
  const update = useUpdateSmsTemplate();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ bodyEn: string; bodyBn: string } | null>(null);

  if (isLoading) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="flex flex-col gap-3">
      {templates?.map((t) => (
        <Card key={t.key} className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-text">{t.key}</span>
            <label className="ml-auto flex items-center gap-1.5 text-xs text-secondary">
              <input
                type="checkbox"
                checked={t.enabled}
                onChange={(e) => update.mutate({ key: t.key, enabled: e.target.checked })}
              />
              Enabled
            </label>
          </div>
          {TEMPLATE_PLACEHOLDERS[t.key] && (
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_PLACEHOLDERS[t.key].map((token) => (
                <span key={token} className="num rounded-pill bg-surface-2 px-2 py-0.5 text-[11px] text-secondary">
                  {`{{${token}}}`}
                </span>
              ))}
            </div>
          )}
          {editing === t.key ? (
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-secondary">English</span>
                <textarea
                  value={draft?.bodyEn ?? t.bodyEn}
                  onChange={(e) => setDraft({ bodyEn: e.target.value, bodyBn: draft?.bodyBn ?? t.bodyBn })}
                  rows={2}
                  className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand-500"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-secondary">বাংলা</span>
                <textarea
                  value={draft?.bodyBn ?? t.bodyBn}
                  onChange={(e) => setDraft({ bodyEn: draft?.bodyEn ?? t.bodyEn, bodyBn: e.target.value })}
                  rows={2}
                  className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand-500"
                />
              </label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="primary"
                  disabled={update.isPending}
                  onClick={() =>
                    update.mutate(
                      { key: t.key, bodyEn: draft?.bodyEn ?? t.bodyEn, bodyBn: draft?.bodyBn ?? t.bodyBn },
                      { onSuccess: () => { setEditing(null); setDraft(null); } },
                    )
                  }
                >
                  Save
                </Button>
                <Button type="button" variant="ghost" onClick={() => { setEditing(null); setDraft(null); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs text-secondary">{t.bodyEn}</p>
              <p className="text-xs text-secondary">{t.bodyBn}</p>
              <Button type="button" variant="ghost" className="self-start" onClick={() => setEditing(t.key)}>
                Edit
              </Button>
            </>
          )}
        </Card>
      ))}
    </div>
  );
}

// Shared by the Logs tab (quick access while reviewing send history) and
// the Settings tab (matches the plugin's dedicated "Send Test SMS" panel).
function TestSendInline() {
  const [to, setTo] = useState("");
  const [body, setBody] = useState("");
  const testSend = useTestSendSms();

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Phone Number</span>
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="+8801XXXXXXXXX"
          className="h-10 w-48 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        />
        <span className="text-xs text-muted">Format: +8801XXXXXXXXX or 01XXXXXXXXX</span>
      </label>
      <label className="flex flex-1 flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Message</span>
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Test message content."
          className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        />
      </label>
      <Button
        type="button"
        variant="primary"
        disabled={testSend.isPending || !to.trim() || !body.trim()}
        onClick={() => testSend.mutate({ to: to.trim(), body: body.trim() }, { onSuccess: () => setBody("") })}
      >
        {testSend.isPending ? "Sending…" : (<><Icon name="mail" size={16} /> Send Test SMS</>)}
      </Button>
    </div>
  );
}

function LogsTab() {
  const { data, isLoading } = useSmsLogs();

  return (
    <div className="flex flex-col gap-4">
      {isLoading && <p className="text-sm text-muted">Loading…</p>}

      <Card className="overflow-hidden p-0">
        <Table>
          <thead>
            <tr>
              <th>To</th>
              <th>Message</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {data && data.items.length === 0 && <TableEmptyRow colSpan={4}>No SMS sent yet.</TableEmptyRow>}
            {data?.items.map((l) => (
              <tr key={l.id}>
                <td className="num text-text">{l.to}</td>
                <td className="max-w-[360px] truncate text-secondary" title={l.body}>
                  {l.body}
                  {l.status === "FAILED" && l.codeMessage && (
                    <span className="block text-xs text-danger">
                      Gateway response {l.code}: {l.codeMessage}
                    </span>
                  )}
                </td>
                <td>
                  <span
                    className={`rounded-pill px-2.5 py-1 text-xs font-semibold ${
                      l.status === "SENT" ? "bg-success/10 text-success" : l.status === "FAILED" ? "bg-danger/10 text-danger" : "bg-border text-secondary"
                    }`}
                  >
                    {l.status}
                  </span>
                </td>
                <td className="text-muted">{new Date(l.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

function SettingsTab() {
  const { data, isLoading } = useSmsSettings();
  const update = useUpdateSmsSettings();
  const clearApiKey = useClearSmsApiKey();
  const clearSecretKey = useClearSmsSecretKey();
  const { data: balance, refetch: checkBalance, isFetching: checkingBalance } = useSmsBalance();
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const { data: otpSettings, isLoading: otpLoading } = useOtpSecuritySettings();
  const updateOtp = useUpdateOtpSecuritySettings();

  if (isLoading || !data) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="flex flex-col gap-5">
      <SettingsCard icon={smsIcon} title="SMS Gateway Configuration">
        <div className="flex flex-col gap-4">
          <ToggleSwitch checked={data.enabled} onChange={(v) => update.mutate({ enabled: v })} label="Enable SMS sending" />
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">API Key {data.hasApiKey && <span className="text-success">(configured)</span>}</span>
              <input
                type="password"
                placeholder={data.hasApiKey ? "••••••••" : "Enter your SMS gateway API key"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
              />
              <span className="text-xs text-muted">Your SMS gateway's apikey, from its dashboard.</span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Secret Key {data.hasSecretKey && <span className="text-success">(configured)</span>}</span>
              <input
                type="password"
                placeholder={data.hasSecretKey ? "••••••••" : "Enter your SMS gateway secret key"}
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
              />
              <span className="text-xs text-muted">Your SMS gateway's secretkey, from its dashboard.</span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Sender ID</span>
              <input
                defaultValue={data.senderId}
                onBlur={(e) => update.mutate({ senderId: e.target.value })}
                placeholder="e.g. 8809xxxxxxx or a masked brand name"
                className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
              />
              <span className="text-xs text-muted">Your approved Sender ID (callerID) from the gateway.</span>
            </label>
          </div>
          <ToggleSwitch
            checked={data.senderIdMasked}
            onChange={(v) => update.mutate({ senderIdMasked: v })}
            label="This sender ID is masked (custom brand name, not a numeric shortcode)"
          />
          <div className="flex items-center gap-2">
            {(apiKey || secretKey) && (
              <Button
                type="button"
                variant="primary"
                disabled={update.isPending}
                onClick={() =>
                  update.mutate(
                    { apiKey: apiKey || undefined, secretKey: secretKey || undefined },
                    { onSuccess: () => { setApiKey(""); setSecretKey(""); } },
                  )
                }
              >
                {update.isPending ? "Saving…" : "Save credentials"}
              </Button>
            )}
            {data.hasApiKey && !apiKey && (
              <Button type="button" variant="ghost" disabled={clearApiKey.isPending} onClick={() => clearApiKey.mutate()}>
                {clearApiKey.isPending ? "Clearing…" : "Clear API key"}
              </Button>
            )}
            {data.hasSecretKey && !secretKey && (
              <Button type="button" variant="ghost" disabled={clearSecretKey.isPending} onClick={() => clearSecretKey.mutate()}>
                {clearSecretKey.isPending ? "Clearing…" : "Clear secret key"}
              </Button>
            )}
          </div>
          <div>
            <span className="text-xs font-semibold text-secondary">SMS Balance</span>
            <p className="mb-2 text-xs text-muted">Check your current SMS credit balance.</p>
            <div className="flex items-center gap-3">
              <Button type="button" variant="ghost" disabled={checkingBalance} onClick={() => checkBalance()}>
                <Icon name="account_balance_wallet" size={16} /> {checkingBalance ? "Checking…" : "Check Balance"}
              </Button>
              {balance !== undefined && (
                <span className="text-sm font-semibold text-text">
                  {balance.balance === null ? "Unavailable" : `৳${balance.balance.toLocaleString()}`}
                </span>
              )}
            </div>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard icon={smsIcon} title="Send Test SMS">
        <TestSendInline />
      </SettingsCard>

      <SettingsCard icon={smsIcon} title="Order status notifications">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted">Which order status transitions send the customer an automatic SMS.</p>
          {STATUS_TRIGGER_LABELS.map((t) => (
            <ToggleSwitch
              key={t.key}
              checked={data.statusTriggers[t.key]}
              onChange={(v) => update.mutate({ statusTriggers: { ...data.statusTriggers, [t.key]: v } })}
              label={`${t.label} → "${t.template}" template`}
            />
          ))}
        </div>
      </SettingsCard>

      <SettingsCard icon={smsIcon} title="Checkout OTP verification">
        {otpLoading || !otpSettings ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <div className="flex flex-col gap-4">
            <ToggleSwitch
              checked={otpSettings.codOtpEnabled}
              onChange={(v) => updateOtp.mutate({ codOtpEnabled: v })}
              label="Require phone OTP verification for Cash on Delivery orders"
            />
            <ToggleSwitch
              checked={otpSettings.codOtpEmailEnabled}
              onChange={(v) => updateOtp.mutate({ codOtpEmailEnabled: v })}
              label="Let customers receive the checkout code by email instead of SMS"
            />
            <p className="-mt-2 text-xs text-muted">
              Adds an SMS / email choice to the checkout verification popup, for customers with no reachable
              Bangladeshi mobile. Turn it off and every checkout code goes by SMS. Only appears for orders that
              actually have an email address, and needs SMTP configured under Settings &rsaquo; Email.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">Code length (digits)</span>
                <input
                  type="number"
                  min={4}
                  max={8}
                  defaultValue={otpSettings.codOtpLength}
                  onBlur={(e) => updateOtp.mutate({ codOtpLength: Number(e.target.value) })}
                  className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">Expiry (minutes)</span>
                <input
                  type="number"
                  min={1}
                  defaultValue={otpSettings.codOtpExpiryMinutes}
                  onBlur={(e) => updateOtp.mutate({ codOtpExpiryMinutes: Number(e.target.value) })}
                  className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">VPN / proxy policy for OTP requests</span>
              <select
                value={otpSettings.vpnPolicy}
                onChange={(e) => updateOtp.mutate({ vpnPolicy: e.target.value as VpnPolicy })}
                className="h-10 w-56 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
              >
                <option value="allow">Allow (just record it)</option>
                <option value="challenge">Challenge (flag for follow-up)</option>
                <option value="block">Block outright</option>
              </select>
            </label>
          </div>
        )}
      </SettingsCard>

      <WebPushCard />
    </div>
  );
}

/**
 * Browser push configuration.
 *
 * Sits under SMS settings rather than in its own page because it is a sibling
 * channel, not a separate product — the same abandoned-cart templates go out
 * over SMS, email or push depending on which channel a template is set to.
 */
function WebPushCard() {
  const { data, isLoading } = usePushSettings();
  const generate = useGeneratePushKeys();
  const update = useUpdatePushSettings();
  const [publicKey, setPublicKey] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [subject, setSubject] = useState("");

  const field =
    "h-10 w-full rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

  return (
    <SettingsCard icon={<Icon name="notifications_active" />} title="Web Push Notifications">
      {isLoading || !data ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="flex flex-col gap-5">
          <p className="text-xs text-secondary">
            Sends a notification to a customer&apos;s browser even when
            amadere.com is closed. Set a template&apos;s channel to Web Push and
            the existing cart-campaign queue delivers it — same delays, quiet
            hours and retries as SMS.
          </p>

          {/* The opt-in funnel is the number that decides whether any of the
              rest of this is worth building on. */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-sm border border-border p-3">
              <p className="text-[0.68rem] font-bold uppercase tracking-wide text-muted">
                Subscribed
              </p>
              <p className="num mt-0.5 text-xl font-bold text-text">{data.active}</p>
            </div>
            <div className="rounded-sm border border-border p-3">
              <p className="text-[0.68rem] font-bold uppercase tracking-wide text-muted">
                Known customer
              </p>
              <p className="num mt-0.5 text-xl font-bold text-text">{data.linkedToCustomer}</p>
            </div>
            <div className="rounded-sm border border-border p-3">
              <p className="text-[0.68rem] font-bold uppercase tracking-wide text-muted">
                Lapsed
              </p>
              <p className="num mt-0.5 text-xl font-bold text-secondary">{data.revoked}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: data.configured ? "#2e7d43" : "#d0555f" }}
            />
            <span style={{ color: data.configured ? "#2e7d43" : "#d0555f" }}>
              {data.configured ? "Keys configured — push is live" : "No keys yet — push is off"}
            </span>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">
              VAPID public key {data.publicKey ? "(in use)" : ""}
            </span>
            <input
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              placeholder={data.publicKey ?? "Paste or generate a key pair"}
              className={field}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">VAPID private key</span>
            <input
              type="password"
              autoComplete="off"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder={data.configured ? "Leave blank to keep the current key" : "Private key"}
              className={field}
            />
            {/* Stored encrypted and never returned, so there is nothing to
                pre-fill and no way to read it back once saved. */}
            <span className="text-[0.68rem] text-muted">
              Stored encrypted. Never shown again.
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">
              Contact address (push services require one)
            </span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="mailto:support@amadere.com"
              className={field}
            />
          </label>

          {generate.data && (
            <div className="rounded-sm border border-amber-400/50 bg-amber-50 p-3 dark:bg-amber-950/20">
              <p className="text-xs font-semibold text-text">
                New pair generated — saving these replaces the old keys and
                unsubscribes every browser currently signed up.
              </p>
              <p className="mt-1.5 break-all font-mono text-[0.68rem] text-secondary">
                public: {generate.data.publicKey}
              </p>
              <p className="mt-1 break-all font-mono text-[0.68rem] text-secondary">
                private: {generate.data.privateKey}
              </p>
              <Button
                type="button"
                variant="ghost"
                className="mt-2"
                onClick={() => {
                  setPublicKey(generate.data!.publicKey);
                  setPrivateKey(generate.data!.privateKey);
                }}
              >
                Copy into the fields above
              </Button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              type="button"
              variant="primary"
              disabled={update.isPending}
              onClick={() =>
                update.mutate(
                  {
                    publicKey: publicKey.trim() || undefined,
                    privateKey: privateKey.trim() || undefined,
                    subject: subject.trim() || undefined,
                  },
                  {
                    onSuccess: () => {
                      setPublicKey("");
                      setPrivateKey("");
                      setSubject("");
                    },
                  },
                )
              }
            >
              {update.isPending ? "Saving…" : "Save keys"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={generate.isPending}
              onClick={() => generate.mutate()}
            >
              {generate.isPending ? "Generating…" : "Generate a new pair"}
            </Button>
          </div>
        </div>
      )}
    </SettingsCard>
  );
}

function BulkSendTab() {
  const [body, setBody] = useState("");
  const [segment, setSegment] = useState<"all" | "has_ordered">("has_ordered");
  const bulkSend = useBulkSendSms();

  return (
    <Card className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Segment</span>
        <select
          value={segment}
          onChange={(e) => setSegment(e.target.value as "all" | "has_ordered")}
          className="h-10 w-64 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        >
          <option value="has_ordered">Customers who have ordered before</option>
          <option value="all">All customers with a phone number</option>
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Message</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand-500"
        />
      </label>
      <Button
        type="button"
        variant="primary"
        className="self-start"
        disabled={bulkSend.isPending || !body.trim()}
        onClick={() => {
          if (!confirm(`Send this SMS to the "${segment}" segment? This cannot be undone.`)) return;
          bulkSend.mutate({ body: body.trim(), segment }, { onSuccess: (r) => alert(`Queued ${r.queued} messages.`) });
        }}
      >
        {bulkSend.isPending ? "Sending…" : "Send broadcast"}
      </Button>
    </Card>
  );
}

export default function SmsPage() {
  const [tab, setTab] = useState("templates");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader icon={smsIcon} title="SMS & OTP" subtitle="Transactional templates, order-status triggers, and checkout verification." />
      <Tabs
        variant="pill"
        options={[
          { value: "templates", label: "Templates" },
          { value: "logs", label: "Send Log" },
          { value: "bulk", label: "Bulk Send" },
          { value: "settings", label: "Settings" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "templates" && <TemplatesTab />}
      {tab === "logs" && <LogsTab />}
      {tab === "bulk" && <BulkSendTab />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}
