"use client";

import { useState } from "react";
import { Button, Card, Icon, PageHeader, StatCard, Tabs, ToggleSwitch } from "@amader/admin-ui";
import {
  useClaritySettings,
  useGa4Settings,
  useGoogleAdsSettings,
  useGtmSettings,
  useMetaSettings,
  useTiktokSettings,
  useUpdateClaritySettings,
  useUpdateGa4Settings,
  useUpdateGoogleAdsSettings,
  useUpdateGtmSettings,
  useUpdateMetaSettings,
  useUpdateTiktokSettings,
  useUpdateUtmSettings,
  useUtmSettings,
} from "@/hooks/useAnalyticsSettings";

const analyticsIcon = <Icon name="monitoring" />;
const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

function ProviderStat({ label, configured, icon }: { label: string; configured: boolean; icon: React.ReactNode }) {
  return (
    <StatCard
      variant={configured ? "success" : "dark"}
      icon={icon}
      label={label}
      value={configured ? "Active" : "Not set up"}
    />
  );
}

function OverviewTab() {
  const { data: ga4 } = useGa4Settings();
  const { data: gtm } = useGtmSettings();
  const { data: meta } = useMetaSettings();
  const { data: googleAds } = useGoogleAdsSettings();
  const { data: tiktok } = useTiktokSettings();
  const { data: clarity } = useClaritySettings();
  const { data: utm } = useUtmSettings();

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <ProviderStat label="GA4" configured={!!ga4?.enabled && !!ga4.measurementId} icon={<Icon name="query_stats" />} />
        <ProviderStat label="Google Tag Manager" configured={!!gtm?.enabled && !!gtm.containerId} icon={<Icon name="dns" />} />
        <ProviderStat label="Meta Pixel + CAPI" configured={!!meta?.enabled && !!meta.pixelId} icon={<Icon name="thumb_up" />} />
        <ProviderStat label="Google Ads" configured={!!googleAds?.enabled && !!googleAds.conversionId} icon={<Icon name="ads_click" />} />
        <ProviderStat label="TikTok Pixel" configured={!!tiktok?.enabled && !!tiktok.pixelCode} icon={<Icon name="music_note" />} />
        <ProviderStat label="Microsoft Clarity" configured={!!clarity?.enabled && !!clarity.projectId} icon={<Icon name="visibility" />} />
      </div>
      <Card className="text-sm text-secondary">
        UTM attribution (utm_source/medium/campaign/term/content capture) is{" "}
        <span className={utm?.enabled ? "font-semibold text-success" : "font-semibold text-muted"}>
          {utm?.enabled ? "enabled" : "disabled"}
        </span>
        . Configure everything, including which providers are turned on, in the Settings tab.
      </Card>
    </div>
  );
}

function Ga4Card() {
  const { data, isLoading } = useGa4Settings();
  const update = useUpdateGa4Settings();
  const [measurementId, setMeasurementId] = useState("");
  const [apiSecret, setApiSecret] = useState("");

  if (isLoading || !data) return <Card><p className="text-sm text-muted">Loading…</p></Card>;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-ui text-sm font-bold text-text">Google Analytics 4</h3>
          <p className="text-xs text-muted">Server-side purchase/sign_up events via the GA4 Measurement Protocol.</p>
        </div>
        <ToggleSwitch checked={data.enabled} onChange={(v) => update.mutate({ enabled: v })} label="Enabled" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Measurement ID</span>
          <input
            placeholder={data.measurementId || "G-XXXXXXXXXX"}
            value={measurementId}
            onChange={(e) => setMeasurementId(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">API Secret {data.hasApiSecret && <span className="text-success">(configured)</span>}</span>
          <input
            type="password"
            placeholder={data.hasApiSecret ? "••••••••" : "Measurement Protocol API secret"}
            value={apiSecret}
            onChange={(e) => setApiSecret(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>
      <Button
        type="button"
        variant="primary"
        className="self-start"
        disabled={update.isPending || (!measurementId && !apiSecret)}
        onClick={() =>
          update.mutate(
            { measurementId: measurementId || undefined, apiSecret: apiSecret || undefined },
            { onSuccess: () => { setMeasurementId(""); setApiSecret(""); } },
          )
        }
      >
        Save
      </Button>
    </Card>
  );
}

function GtmCard() {
  const { data, isLoading } = useGtmSettings();
  const update = useUpdateGtmSettings();
  const [containerId, setContainerId] = useState("");

  if (isLoading || !data) return <Card><p className="text-sm text-muted">Loading…</p></Card>;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-ui text-sm font-bold text-text">Google Tag Manager</h3>
          <p className="text-xs text-muted">Injects the GTM container script + noscript iframe on every storefront page.</p>
        </div>
        <ToggleSwitch checked={data.enabled} onChange={(v) => update.mutate({ enabled: v })} label="Enabled" />
      </div>
      <label className="flex max-w-xs flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Container ID</span>
        <input placeholder={data.containerId || "GTM-XXXXXXX"} value={containerId} onChange={(e) => setContainerId(e.target.value)} className={inputClass} />
      </label>
      <Button
        type="button"
        variant="primary"
        className="self-start"
        disabled={update.isPending || !containerId}
        onClick={() => update.mutate({ containerId }, { onSuccess: () => setContainerId("") })}
      >
        Save
      </Button>
    </Card>
  );
}

function MetaCard() {
  const { data, isLoading } = useMetaSettings();
  const update = useUpdateMetaSettings();
  const [pixelId, setPixelId] = useState("");
  const [testEventCode, setTestEventCode] = useState("");
  const [accessToken, setAccessToken] = useState("");

  if (isLoading || !data) return <Card><p className="text-sm text-muted">Loading…</p></Card>;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-ui text-sm font-bold text-text">Meta Pixel &amp; Conversions API</h3>
          <p className="text-xs text-muted">Browser pixel + server-side CAPI, same Pixel ID for both.</p>
        </div>
        <ToggleSwitch checked={data.enabled} onChange={(v) => update.mutate({ enabled: v })} label="Enabled" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Pixel ID</span>
          <input placeholder={data.pixelId || "Pixel ID"} value={pixelId} onChange={(e) => setPixelId(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Access Token {data.hasAccessToken && <span className="text-success">(configured)</span>}</span>
          <input
            type="password"
            placeholder={data.hasAccessToken ? "••••••••" : "CAPI access token"}
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Test Event Code (optional)</span>
          <input
            placeholder={data.testEventCode || "TEST12345 — for Events Manager test events"}
            value={testEventCode}
            onChange={(e) => setTestEventCode(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>
      <Button
        type="button"
        variant="primary"
        className="self-start"
        disabled={update.isPending || (!pixelId && !accessToken && !testEventCode)}
        onClick={() =>
          update.mutate(
            { pixelId: pixelId || undefined, accessToken: accessToken || undefined, testEventCode: testEventCode || undefined },
            { onSuccess: () => { setPixelId(""); setAccessToken(""); setTestEventCode(""); } },
          )
        }
      >
        Save
      </Button>
    </Card>
  );
}

function GoogleAdsCard() {
  const { data, isLoading } = useGoogleAdsSettings();
  const update = useUpdateGoogleAdsSettings();
  const [conversionId, setConversionId] = useState("");
  const [conversionLabel, setConversionLabel] = useState("");

  if (isLoading || !data) return <Card><p className="text-sm text-muted">Loading…</p></Card>;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-ui text-sm font-bold text-text">Google Ads</h3>
          <p className="text-xs text-muted">Client-side purchase conversion tracking via the gtag.js conversion linker.</p>
        </div>
        <ToggleSwitch checked={data.enabled} onChange={(v) => update.mutate({ enabled: v })} label="Enabled" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Conversion ID</span>
          <input placeholder={data.conversionId || "AW-XXXXXXXXX"} value={conversionId} onChange={(e) => setConversionId(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Conversion Label (optional)</span>
          <input placeholder={data.conversionLabel || "Purchase conversion label"} value={conversionLabel} onChange={(e) => setConversionLabel(e.target.value)} className={inputClass} />
        </label>
      </div>
      <Button
        type="button"
        variant="primary"
        className="self-start"
        disabled={update.isPending || (!conversionId && !conversionLabel)}
        onClick={() =>
          update.mutate(
            { conversionId: conversionId || undefined, conversionLabel: conversionLabel || undefined },
            { onSuccess: () => { setConversionId(""); setConversionLabel(""); } },
          )
        }
      >
        Save
      </Button>
    </Card>
  );
}

function TiktokCard() {
  const { data, isLoading } = useTiktokSettings();
  const update = useUpdateTiktokSettings();
  const [pixelCode, setPixelCode] = useState("");
  const [accessToken, setAccessToken] = useState("");

  if (isLoading || !data) return <Card><p className="text-sm text-muted">Loading…</p></Card>;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-ui text-sm font-bold text-text">TikTok Pixel</h3>
          <p className="text-xs text-muted">Browser pixel + server-side Events API, same Pixel Code for both.</p>
        </div>
        <ToggleSwitch checked={data.enabled} onChange={(v) => update.mutate({ enabled: v })} label="Enabled" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Pixel Code</span>
          <input placeholder={data.pixelCode || "Pixel Code"} value={pixelCode} onChange={(e) => setPixelCode(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Access Token {data.hasAccessToken && <span className="text-success">(configured)</span>}</span>
          <input
            type="password"
            placeholder={data.hasAccessToken ? "••••••••" : "Events API access token"}
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>
      <Button
        type="button"
        variant="primary"
        className="self-start"
        disabled={update.isPending || (!pixelCode && !accessToken)}
        onClick={() =>
          update.mutate(
            { pixelCode: pixelCode || undefined, accessToken: accessToken || undefined },
            { onSuccess: () => { setPixelCode(""); setAccessToken(""); } },
          )
        }
      >
        Save
      </Button>
    </Card>
  );
}

function ClarityCard() {
  const { data, isLoading } = useClaritySettings();
  const update = useUpdateClaritySettings();
  const [projectId, setProjectId] = useState("");

  if (isLoading || !data) return <Card><p className="text-sm text-muted">Loading…</p></Card>;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-ui text-sm font-bold text-text">Microsoft Clarity</h3>
          <p className="text-xs text-muted">Session recordings and heatmaps.</p>
        </div>
        <ToggleSwitch checked={data.enabled} onChange={(v) => update.mutate({ enabled: v })} label="Enabled" />
      </div>
      <label className="flex max-w-xs flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Project ID</span>
        <input placeholder={data.projectId || "Project ID"} value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputClass} />
      </label>
      <Button
        type="button"
        variant="primary"
        className="self-start"
        disabled={update.isPending || !projectId}
        onClick={() => update.mutate({ projectId }, { onSuccess: () => setProjectId("") })}
      >
        Save
      </Button>
    </Card>
  );
}

function UtmCard() {
  const { data, isLoading } = useUtmSettings();
  const update = useUpdateUtmSettings();

  if (isLoading || !data) return <Card><p className="text-sm text-muted">Loading…</p></Card>;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-ui text-sm font-bold text-text">UTM Attribution</h3>
          <p className="text-xs text-muted">
            Captures utm_source/utm_medium/utm_campaign/utm_term/utm_content from the landing URL, keeps them for the
            session, and attaches them to analytics events and orders for campaign attribution.
          </p>
        </div>
        <ToggleSwitch checked={data.enabled} onChange={(v) => update.mutate({ enabled: v })} label="Enabled" />
      </div>
    </Card>
  );
}

function SettingsTab() {
  return (
    <div className="flex flex-col gap-4">
      <Ga4Card />
      <GtmCard />
      <MetaCard />
      <GoogleAdsCard />
      <TiktokCard />
      <ClarityCard />
      <UtmCard />
    </div>
  );
}

export default function AnalyticsPage() {
  const [tab, setTab] = useState("overview");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={analyticsIcon}
        title="Analytics"
        subtitle="Tracking pixels, conversions API credentials, and UTM attribution."
        style={{ background: "linear-gradient(135deg, #140A24 0%, #5F03AA 100%)" }}
      />
      <Tabs
        options={[
          { value: "overview", label: "Overview" },
          { value: "settings", label: "Settings" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "overview" && <OverviewTab />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}
