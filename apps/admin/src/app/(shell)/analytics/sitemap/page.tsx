"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Icon, PageHeader, ToggleSwitch } from "@amader/admin-ui";
import {
  useGenerateIndexNowKey,
  usePingIndexNow,
  useSitemapSettings,
  useUpdateSitemapSettings,
} from "@/hooks/useSitemap";

const sitemapIcon = <Icon name="account_tree" />;

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <input readOnly value={value} className="h-9 flex-1 rounded-sm border border-border bg-surface-2 px-3 font-mono text-xs text-text outline-none" />
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

export default function SitemapPage() {
  const { data, isLoading } = useSitemapSettings();
  const update = useUpdateSitemapSettings();
  const generateKey = useGenerateIndexNowKey();
  const ping = usePingIndexNow();
  const [pingResult, setPingResult] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={sitemapIcon}
        title="Sitemap"
        subtitle="sitemap.xml generation and search-engine indexing."
        style={{ background: "linear-gradient(135deg, #140A24 0%, #5F03AA 100%)" }}
      />

      <Link href="/analytics" className="flex items-center gap-1.5 text-sm font-semibold text-brand-500">
        <Icon name="arrow_back" size={16} /> Back to Analytics
      </Link>

      {isLoading || !data ? (
        <Card><p className="text-sm text-muted">Loading…</p></Card>
      ) : (
        <>
          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-ui text-sm font-bold text-text">Sitemap</h3>
                <p className="text-xs text-muted">
                  Automatically generated and always up to date — every request rebuilds it live from published
                  products, categories, brands, tags, bundles, blog posts, and pages, so there&apos;s no cache to go
                  stale.
                </p>
              </div>
              <ToggleSwitch checked={data.enabled} onChange={(v) => update.mutate({ enabled: v })} label="Enabled" />
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-sm bg-surface-2 p-3 text-sm">
              <div>
                <span className="text-xs font-semibold text-secondary">Sitemap URL</span>
                <div>
                  <a href={data.sitemapUrl} target="_blank" rel="noreferrer" className="text-brand-500 hover:underline">
                    {data.sitemapUrl}
                  </a>
                </div>
              </div>
              <div>
                <span className="text-xs font-semibold text-secondary">robots.txt</span>
                <div>
                  <a href={data.robotsUrl} target="_blank" rel="noreferrer" className="text-brand-500 hover:underline">
                    {data.robotsUrl}
                  </a>
                </div>
              </div>
              <div>
                <span className="text-xs font-semibold text-secondary">URLs included</span>
                <div className="font-bold text-text">{data.urlCount.toLocaleString()}</div>
              </div>
            </div>
          </Card>

          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-ui text-sm font-bold text-text">IndexNow</h3>
                <p className="text-xs text-muted">
                  Notifies Bing, Yandex, Seznam, and Naver directly when your content changes, for faster re-indexing
                  than waiting for a normal crawl. (Google has no equivalent public protocol.)
                </p>
              </div>
              <ToggleSwitch checked={data.indexNowEnabled} onChange={(v) => update.mutate({ indexNowEnabled: v })} label="Enabled" />
            </div>

            {data.indexNowKey ? (
              <div className="flex flex-col gap-3 rounded-sm bg-surface-2 p-3">
                <div>
                  <span className="text-xs font-semibold text-secondary">API Key</span>
                  <CopyField value={data.indexNowKey} />
                </div>
                <div>
                  <span className="text-xs font-semibold text-secondary">Verification file (must be reachable at this URL)</span>
                  {data.indexNowFileUrl && (
                    <div className="flex items-center gap-2">
                      <a href={data.indexNowFileUrl} target="_blank" rel="noreferrer" className="text-sm text-brand-500 hover:underline">
                        {data.indexNowFileUrl}
                      </a>
                      <span className="text-xs text-muted">(Test Key File)</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Button type="button" variant="ghost" disabled={generateKey.isPending} onClick={() => generateKey.mutate()}>
                    {generateKey.isPending ? "Regenerating…" : "Regenerate Key"}
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={ping.isPending || !data.indexNowEnabled}
                    onClick={() =>
                      ping.mutate(undefined, {
                        onSuccess: (r) => setPingResult(r.message),
                        onError: (e) => setPingResult(e instanceof Error ? e.message : "Ping failed"),
                      })
                    }
                  >
                    {ping.isPending ? "Pinging…" : "Ping search engines now"}
                  </Button>
                  {pingResult && <span className="text-xs text-secondary">{pingResult}</span>}
                </div>
              </div>
            ) : (
              <Button type="button" variant="primary" className="self-start" disabled={generateKey.isPending} onClick={() => generateKey.mutate()}>
                {generateKey.isPending ? "Generating…" : "Generate API Key"}
              </Button>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
