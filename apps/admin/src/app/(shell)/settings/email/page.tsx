"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Icon, PageHeader, ToggleSwitch } from "@amader/admin-ui";
import { useEmailSettings, useSendTestEmail, useUpdateEmailSettings, type SmtpEncryption } from "@/hooks/useEmailSettings";

const emailIcon = <Icon name="mail" />;
const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

export default function EmailSettingsPage() {
  const { data, isLoading } = useEmailSettings();
  const update = useUpdateEmailSettings();
  const sendTest = useSendTestEmail();

  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [testTo, setTestTo] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
        icon={emailIcon}
        title="Email Settings"
        subtitle="SMTP configuration used to send emails site-wide."
        style={{ background: "linear-gradient(135deg, #140A24 0%, #5F03AA 100%)" }}
      />
        <Card><p className="text-sm text-muted">Loading…</p></Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={emailIcon}
        title="Email Settings"
        subtitle="SMTP configuration used to send emails site-wide."
        style={{ background: "linear-gradient(135deg, #140A24 0%, #5F03AA 100%)" }}
      />
      <Link href="/settings" className="flex items-center gap-1.5 text-sm font-semibold text-brand-500">
        <Icon name="arrow_back" size={16} /> Back to Settings
      </Link>

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-ui text-sm font-bold text-text">Mailer (SMTP)</h3>
          <ToggleSwitch checked={data.enabled} onChange={(v) => update.mutate({ enabled: v })} label="Enabled" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Host</span>
            <input placeholder={data.host || "smtp.gmail.com"} value={host} onChange={(e) => setHost(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Port</span>
            <input type="number" placeholder={String(data.port)} value={port} onChange={(e) => setPort(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Username</span>
            <input placeholder={data.username || "Login username"} value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Password {data.hasPassword && <span className="text-success">(configured)</span>}</span>
            <input
              type="password"
              placeholder={data.hasPassword ? "••••••••" : "SMTP password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Encryption</span>
            <select value={data.encryption} onChange={(e) => update.mutate({ encryption: e.target.value as SmtpEncryption })} className={inputClass}>
              <option value="tls">TLS</option>
              <option value="ssl">SSL</option>
              <option value="none">None</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Sender name</span>
            <input placeholder={data.senderName || "Amader"} value={senderName} onChange={(e) => setSenderName(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Sender email</span>
            <input placeholder={data.senderEmail || "no-reply@yourdomain.com"} value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} className={inputClass} />
          </label>
        </div>
        <Button
          type="button"
          variant="primary"
          className="self-start"
          disabled={update.isPending || (!host && !port && !username && !password && !senderName && !senderEmail)}
          onClick={() =>
            update.mutate(
              {
                host: host || undefined,
                port: port ? Number(port) : undefined,
                username: username || undefined,
                password: password || undefined,
                senderName: senderName || undefined,
                senderEmail: senderEmail || undefined,
              },
              { onSuccess: () => { setHost(""); setPort(""); setUsername(""); setPassword(""); setSenderName(""); setSenderEmail(""); } },
            )
          }
        >
          Save
        </Button>
      </Card>

      <Card className="flex flex-col gap-3">
        <h3 className="font-ui text-sm font-bold text-text">Send Test Email</h3>
        <div className="flex items-center gap-3">
          <input
            type="email"
            placeholder="you@example.com"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            className={`${inputClass} w-64`}
          />
          <Button
            type="button"
            variant="primary"
            disabled={sendTest.isPending || !testTo}
            onClick={() =>
              sendTest.mutate(testTo, {
                onSuccess: (r) => setTestResult(r.success ? `✓ ${r.message}` : `✗ ${r.message}`),
                onError: (e) => setTestResult(`✗ ${e instanceof Error ? e.message : "Failed"}`),
              })
            }
          >
            {sendTest.isPending ? "Sending…" : "Send test email"}
          </Button>
          {testResult && <span className="text-xs text-secondary">{testResult}</span>}
        </div>
      </Card>
    </div>
  );
}
