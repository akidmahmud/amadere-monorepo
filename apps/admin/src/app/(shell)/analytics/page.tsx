"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Icon, PageHeader, StatCard, Tabs, ToggleSwitch } from "@amader/admin-ui";
import {
  useClaritySettings,
  useCustomScriptSettings,
  useGa4Settings,
  useGoogleAdsSettings,
  useGtmSettings,
  useMetaSettings,
  useTiktokSettings,
  useUpdateClaritySettings,
  useUpdateCustomScriptSettings,
  useUpdateGa4Settings,
  useUpdateGoogleAdsSettings,
  useUpdateGtmSettings,
  useUpdateMetaSettings,
  useUpdateTiktokSettings,
  useUpdateUtmSettings,
  useUtmSettings,
} from "@/hooks/useAnalyticsSettings";
import { useSitemapSettings } from "@/hooks/useSitemap";

const analyticsIcon = <Icon name="monitoring" />;
const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";
const textareaClass =
  "min-h-[120px] rounded-sm border border-border bg-surface px-3 py-2 font-mono text-xs text-text outline-none focus:border-brand-500";

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
  const { data: customScript } = useCustomScriptSettings();
  const { data: sitemap } = useSitemapSettings();

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <ProviderStat label="GA4" configured={!!ga4?.enabled && !!ga4.measurementId} icon={<Icon name="query_stats" />} />
        <ProviderStat label="Google Tag Manager" configured={!!gtm?.enabled && !!gtm.containerId} icon={<Icon name="dns" />} />
        <ProviderStat label="Meta Pixel" configured={!!meta?.enabled && !!meta.pixelId} icon={<Icon name="thumb_up" />} />
        <ProviderStat label="Google Ads" configured={!!googleAds?.enabled && !!googleAds.conversionId} icon={<Icon name="ads_click" />} />
        <ProviderStat label="TikTok Pixel" configured={!!tiktok?.enabled && !!tiktok.pixelCode} icon={<Icon name="music_note" />} />
        <ProviderStat label="Microsoft Clarity" configured={!!clarity?.enabled && !!clarity.projectId} icon={<Icon name="visibility" />} />
        <ProviderStat
          label="Custom Tracking Code"
          configured={!!customScript?.enabled && !!customScript.headerScript}
          icon={<Icon name="code" />}
        />
        <ProviderStat label="Sitemap" configured={!!sitemap?.enabled} icon={<Icon name="account_tree" />} />
      </div>

      <Card className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-inner bg-brand-50 text-brand-500">
            <Icon name="account_tree" />
          </div>
          <div>
            <h3 className="font-ui text-sm font-bold text-text">Sitemap &amp; search-engine indexing</h3>
            <p className="text-xs text-muted">
              {sitemap ? `${sitemap.urlCount.toLocaleString()} URLs live` : "…"} · IndexNow{" "}
              {sitemap?.indexNowEnabled ? "enabled" : "disabled"}
            </p>
          </div>
        </div>
        <Link href="/analytics/sitemap" className="inline-flex h-9 items-center gap-1.5 rounded-inner border border-border px-3 text-sm font-semibold text-text hover:bg-surface-2">
          Manage <Icon name="arrow_forward" size={16} />
        </Link>
      </Card>

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

  if (isLoading || !data) return <Card><p className="text-sm text-muted">Loading…</p></Card>;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-ui text-sm font-bold text-text">Google Analytics 4</h3>
          <p className="text-xs text-muted">Client-side gtag.js tag on every storefront page. Server-side event forwarding is handled by server-side GTM, not this backend.</p>
        </div>
        <ToggleSwitch checked={data.enabled} onChange={(v) => update.mutate({ enabled: v })} label="Enabled" />
      </div>
      <label className="flex max-w-xs flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Measurement ID</span>
        <input
          placeholder={data.measurementId || "G-XXXXXXXXXX"}
          value={measurementId}
          onChange={(e) => setMeasurementId(e.target.value)}
          className={inputClass}
        />
      </label>
      <Button
        type="button"
        variant="primary"
        className="self-start"
        disabled={update.isPending || !measurementId}
        onClick={() => update.mutate({ measurementId }, { onSuccess: () => setMeasurementId("") })}
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

  if (isLoading || !data) return <Card><p className="text-sm text-muted">Loading…</p></Card>;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-ui text-sm font-bold text-text">Meta Pixel</h3>
          <p className="text-xs text-muted">Client-side browser pixel on every storefront page. Server-side Conversions API events are handled by server-side GTM, not this backend.</p>
        </div>
        <ToggleSwitch checked={data.enabled} onChange={(v) => update.mutate({ enabled: v })} label="Enabled" />
      </div>
      <label className="flex max-w-xs flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Pixel ID</span>
        <input placeholder={data.pixelId || "Pixel ID"} value={pixelId} onChange={(e) => setPixelId(e.target.value)} className={inputClass} />
      </label>
      <Button
        type="button"
        variant="primary"
        className="self-start"
        disabled={update.isPending || !pixelId}
        onClick={() => update.mutate({ pixelId }, { onSuccess: () => setPixelId("") })}
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

  if (isLoading || !data) return <Card><p className="text-sm text-muted">Loading…</p></Card>;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-ui text-sm font-bold text-text">TikTok Pixel</h3>
          <p className="text-xs text-muted">Client-side browser pixel on every storefront page. Server-side Events API events are handled by server-side GTM, not this backend.</p>
        </div>
        <ToggleSwitch checked={data.enabled} onChange={(v) => update.mutate({ enabled: v })} label="Enabled" />
      </div>
      <label className="flex max-w-xs flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Pixel Code</span>
        <input placeholder={data.pixelCode || "Pixel Code"} value={pixelCode} onChange={(e) => setPixelCode(e.target.value)} className={inputClass} />
      </label>
      <Button
        type="button"
        variant="primary"
        className="self-start"
        disabled={update.isPending || !pixelCode}
        onClick={() => update.mutate({ pixelCode }, { onSuccess: () => setPixelCode("") })}
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

function CustomScriptCard() {
  const { data, isLoading } = useCustomScriptSettings();
  const update = useUpdateCustomScriptSettings();
  const [headerScript, setHeaderScript] = useState("");
  const [bodyScript, setBodyScript] = useState("");
  const [dirty, setDirty] = useState(false);

  if (isLoading || !data) return <Card><p className="text-sm text-muted">Loading…</p></Card>;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-ui text-sm font-bold text-text">Custom Tracking Code</h3>
          <p className="text-xs text-muted">
            For advanced tracking scripts (Matomo, Plausible, Fathom, etc.) that don&apos;t have a dedicated
            provider above — pasted exactly as given, additive to everything else on this page.
          </p>
        </div>
        <ToggleSwitch checked={data.enabled} onChange={(v) => update.mutate({ enabled: v })} label="Enabled" />
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Step 1: Header tracking script</span>
        <textarea
          placeholder={data.headerScript || "<script>...</script>"}
          value={dirty ? headerScript : data.headerScript}
          onChange={(e) => { setDirty(true); setHeaderScript(e.target.value); }}
          className={textareaClass}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Step 2: Body tracking code (optional)</span>
        <textarea
          placeholder={data.bodyScript || "<noscript>...</noscript>"}
          value={dirty ? bodyScript : data.bodyScript}
          onChange={(e) => { setDirty(true); setBodyScript(e.target.value); }}
          className={textareaClass}
        />
      </label>
      <Button
        type="button"
        variant="primary"
        className="self-start"
        disabled={update.isPending || !dirty}
        onClick={() => update.mutate({ headerScript, bodyScript }, { onSuccess: () => setDirty(false) })}
      >
        Save
      </Button>
    </Card>
  );
}

function SettingsTab() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <CustomScriptCard />
      </div>
      <Ga4Card />
      <GtmCard />
      <MetaCard />
      <GoogleAdsCard />
      <TiktokCard />
      <ClarityCard />
      <div className="md:col-span-2">
        <UtmCard />
      </div>
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
        subtitle="Client-side tracking pixels, custom tracking code, and UTM attribution."
        style={{ background: "linear-gradient(135deg, #140A24 0%, #5F03AA 100%)" }}
        actions={
          <Link
            href="/analytics/sitemap"
            className="inline-flex h-10 items-center gap-2 rounded-inner bg-white/15 px-4 text-sm font-semibold text-white hover:bg-white/25"
          >
            <Icon name="account_tree" size={16} /> Sitemap
          </Link>
        }
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
