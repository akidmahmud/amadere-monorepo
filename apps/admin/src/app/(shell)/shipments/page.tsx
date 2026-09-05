"use client";

import { useState } from "react";
import { Button, Card, Tabs } from "@amader/admin-ui";
import { DispatchQueueTable } from "@/components/shipments/DispatchQueueTable";
import { DeletedOrdersTab } from "@/app/(shell)/net-profit/orders/DeletedOrdersTab";
import {
  usePathaoSettings,
  useRedxSettings,
  useSteadfastSettings,
  useSteadfastWebhookSettings,
  useTestPathaoConnection,
  useTestRedxConnection,
  useUpdatePathaoSettings,
  useUpdateRedxSettings,
  useUpdateSteadfastSettings,
  useUpdateSteadfastWebhookToken,
} from "@/hooks/useCourierSettings";
import { ShippingRatesTab } from "@/components/shipments/ShippingRatesTab";
import { ShippingRulesTab } from "@/components/shipments/ShippingRulesTab";

// Same charset convention as the rest of this app's generated-secret helpers
// (e.g. RegisterForm's generatePassword) — a webhook token is pasted into
// Steadfast's merchant portal by hand, so it stays free of characters that
// read ambiguously at a glance.
function generateWebhookToken(length = 40): string {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => charset[v % charset.length]).join("");
}

function SteadfastWebhookCard() {
  const { data, isLoading } = useSteadfastWebhookSettings();
  const update = useUpdateSteadfastWebhookToken();
  const [token, setToken] = useState("");
  const [copied, setCopied] = useState(false);

  if (isLoading || !data) return <Card><p className="text-sm text-muted">Loading…</p></Card>;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-ui text-sm font-bold text-text">Steadfast Webhook</h3>
        {data.hasToken && <span className="text-xs font-semibold text-success">Configured</span>}
      </div>
      <p className="text-xs text-secondary">
        Steadfast calls this URL when a shipment's status changes (delivered/returned/canceled auto-updates the order).
        Paste it into Steadfast&apos;s merchant portal along with the token below, sent as an{" "}
        <code className="rounded-sm bg-surface-2 px-1 py-0.5">Authorization: Bearer &lt;token&gt;</code> header.
      </p>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Webhook URL</span>
        <div className="flex gap-2">
          <input readOnly value={data.webhookUrl} className="h-10 flex-1 rounded-sm border border-border bg-surface-2 px-3 text-sm text-text outline-none" />
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              navigator.clipboard.writeText(data.webhookUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Webhook Token {data.hasToken && <span className="text-success">(configured)</span>}</span>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={data.hasToken ? "Leave blank to keep the existing token" : "Generate or paste a token"}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="h-10 flex-1 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
          <Button type="button" variant="ghost" onClick={() => setToken(generateWebhookToken())}>
            Generate
          </Button>
        </div>
      </label>
      <Button
        type="button"
        variant="primary"
        className="self-start"
        disabled={update.isPending || !token}
        onClick={() => update.mutate(token, { onSuccess: () => setToken("") })}
      >
        Save token
      </Button>
    </Card>
  );
}

function SteadfastSettingsCard() {
  const { data, isLoading } = useSteadfastSettings();
  const update = useUpdateSteadfastSettings();
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");

  if (isLoading || !data) return <Card><p className="text-sm text-muted">Loading…</p></Card>;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-ui text-sm font-bold text-text">Steadfast</h3>
        <label className="flex items-center gap-2 text-sm text-secondary">
          <input type="checkbox" checked={data.enabled} onChange={(e) => update.mutate({ enabled: e.target.checked })} />
          Enabled
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">API Key {data.hasApiKey && <span className="text-success">(configured)</span>}</span>
          <input
            type="password"
            placeholder={data.hasApiKey ? "••••••••" : "Enter API key"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Secret Key {data.hasSecretKey && <span className="text-success">(configured)</span>}</span>
          <input
            type="password"
            placeholder={data.hasSecretKey ? "••••••••" : "Enter secret key"}
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
      </div>
      <Button
        type="button"
        variant="primary"
        className="self-start"
        disabled={update.isPending || (!apiKey && !secretKey)}
        onClick={() => update.mutate({ apiKey: apiKey || undefined, secretKey: secretKey || undefined }, { onSuccess: () => { setApiKey(""); setSecretKey(""); } })}
      >
        Save credentials
      </Button>
    </Card>
  );
}

function PathaoSettingsCard() {
  const { data, isLoading } = usePathaoSettings();
  const update = useUpdatePathaoSettings();
  const test = useTestPathaoConnection();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [storeId, setStoreId] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);

  if (isLoading || !data) return <Card><p className="text-sm text-muted">Loading…</p></Card>;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-ui text-sm font-bold text-text">Pathao</h3>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-secondary">
            <input type="checkbox" checked={data.enabled} onChange={(e) => update.mutate({ enabled: e.target.checked })} />
            Enabled
          </label>
          <select
            value={data.environment}
            onChange={(e) => update.mutate({ environment: e.target.value as "live" | "sandbox" })}
            className="h-9 rounded-sm border border-border bg-surface px-2 text-xs text-text outline-none"
          >
            <option value="live">Live</option>
            <option value="sandbox">Sandbox</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Client ID</span>
          <input placeholder={data.clientId || "Client ID"} value={clientId} onChange={(e) => setClientId(e.target.value)} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Client Secret {data.hasClientSecret && <span className="text-success">(configured)</span>}</span>
          <input type="password" placeholder={data.hasClientSecret ? "••••••••" : "Client Secret"} value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Username</span>
          <input placeholder={data.username || "Merchant username"} value={username} onChange={(e) => setUsername(e.target.value)} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Password {data.hasPassword && <span className="text-success">(configured)</span>}</span>
          <input type="password" placeholder={data.hasPassword ? "••••••••" : "Password"} value={password} onChange={(e) => setPassword(e.target.value)} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Default Store ID</span>
          <input type="number" placeholder={data.storeId ? String(data.storeId) : "Store ID"} value={storeId} onChange={(e) => setStoreId(e.target.value)} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
        </label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-secondary">
          <input type="checkbox" checked={data.autoStatusSync} onChange={(e) => update.mutate({ autoStatusSync: e.target.checked })} />
          Auto-sync order status from courier
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="primary"
          disabled={update.isPending}
          onClick={() =>
            update.mutate(
              { clientId: clientId || undefined, clientSecret: clientSecret || undefined, username: username || undefined, password: password || undefined, storeId: storeId ? Number(storeId) : undefined },
              { onSuccess: () => { setClientId(""); setClientSecret(""); setUsername(""); setPassword(""); setStoreId(""); } },
            )
          }
        >
          Save credentials
        </Button>
        <Button type="button" variant="ghost" disabled={test.isPending} onClick={() => test.mutate(undefined, { onSuccess: (r) => setTestResult(r.message), onError: (e) => setTestResult(e instanceof Error ? e.message : "Test failed") })}>
          {test.isPending ? "Testing…" : "Test connection"}
        </Button>
        {testResult && <span className="text-xs text-secondary">{testResult}</span>}
      </div>
    </Card>
  );
}

function RedxSettingsCard() {
  const { data, isLoading } = useRedxSettings();
  const update = useUpdateRedxSettings();
  const test = useTestRedxConnection();
  const [apiToken, setApiToken] = useState("");
  const [pickupStoreId, setPickupStoreId] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);

  if (isLoading || !data) return <Card><p className="text-sm text-muted">Loading…</p></Card>;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-ui text-sm font-bold text-text">RedX</h3>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-secondary">
            <input type="checkbox" checked={data.enabled} onChange={(e) => update.mutate({ enabled: e.target.checked })} />
            Enabled
          </label>
          <select
            value={data.environment}
            onChange={(e) => update.mutate({ environment: e.target.value as "live" | "sandbox" })}
            className="h-9 rounded-sm border border-border bg-surface px-2 text-xs text-text outline-none"
          >
            <option value="live">Live</option>
            <option value="sandbox">Sandbox</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">API Access Token {data.hasApiToken && <span className="text-success">(configured)</span>}</span>
          <input type="password" placeholder={data.hasApiToken ? "••••••••" : "API token"} value={apiToken} onChange={(e) => setApiToken(e.target.value)} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Default Pickup Store ID</span>
          <input type="number" placeholder={data.pickupStoreId ? String(data.pickupStoreId) : "Pickup store ID"} value={pickupStoreId} onChange={(e) => setPickupStoreId(e.target.value)} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
        </label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-secondary">
          <input type="checkbox" checked={data.autoStatusSync} onChange={(e) => update.mutate({ autoStatusSync: e.target.checked })} />
          Auto-sync order status from courier
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="primary"
          disabled={update.isPending}
          onClick={() => update.mutate({ apiToken: apiToken || undefined, pickupStoreId: pickupStoreId ? Number(pickupStoreId) : undefined }, { onSuccess: () => { setApiToken(""); setPickupStoreId(""); } })}
        >
          Save credentials
        </Button>
        <Button type="button" variant="ghost" disabled={test.isPending} onClick={() => test.mutate(undefined, { onSuccess: (r) => setTestResult(r.message), onError: (e) => setTestResult(e instanceof Error ? e.message : "Test failed") })}>
          {test.isPending ? "Testing…" : "Test connection"}
        </Button>
        {testResult && <span className="text-xs text-secondary">{testResult}</span>}
      </div>
    </Card>
  );
}

function SettingsTab() {
  return (
    <div className="flex flex-col gap-4">
      <SteadfastSettingsCard />
      <SteadfastWebhookCard />
      <PathaoSettingsCard />
      <RedxSettingsCard />
    </div>
  );
}

export default function ShipmentsPage() {
  const [tab, setTab] = useState("shipments");

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        options={[
          { value: "shipments", label: "Shipments" },
          { value: "deleted", label: "Deleted Orders" },
          { value: "settings", label: "Courier Settings" },
          { value: "rates", label: "Shipping Rates" },
          { value: "rules", label: "Shipping Rules" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "shipments" && <DispatchQueueTable />}
      {/* Same soft-deleted Order pool Order Manager's trash tab shows — a
          dispatch-queue row IS an order, so deleting/restoring one here
          means the exact same thing it does there. Reusing that tab instead
          of building a second bespoke trash view. */}
      {tab === "deleted" && <DeletedOrdersTab />}
      {tab === "settings" && <SettingsTab />}
      {/* What the CUSTOMER pays at checkout — distinct from Courier
          Settings above, which is what the courier charges US. */}
      {tab === "rates" && <ShippingRatesTab />}
      {/* The mirror image of Shipping Rates: what the courier bills US per
          parcel by district and weight. Advisory unless its checkout toggle
          is switched on. */}
      {tab === "rules" && <ShippingRulesTab />}
    </div>
  );
}
