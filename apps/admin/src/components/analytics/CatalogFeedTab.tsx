"use client";

import { useState } from "react";
import { Button, Card, Icon, StatCard } from "@amader/admin-ui";
import { useCatalogFeedStatus, useRefreshCatalogFeed } from "@/hooks/useCatalogFeed";

/**
 * "Catalog Data Feed" — the three feed URLs staff paste into Meta Commerce
 * Manager, Google Merchant Center and TikTok Ads Manager.
 *
 * Read-only apart from the manual refresh: the feed has no settings of its
 * own, it is derived entirely from the published products. Anything wrong
 * with it is fixed on the product, which is why the data-quality problems
 * are listed here with counts rather than hidden behind a log file.
 */

function FeedRow({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-inner border border-border bg-surface-2 px-3 py-2.5">
      <span className="w-[92px] shrink-0 font-mono text-[11px] text-secondary">{label}</span>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="min-w-0 flex-1 truncate font-mono text-xs text-brand-600 hover:underline dark:text-brand-400"
      >
        {url}
      </a>
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          void navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

export function CatalogFeedTab() {
  const { data, isLoading } = useCatalogFeedStatus();
  const refresh = useRefreshCatalogFeed();

  if (isLoading || !data) {
    return <Card className="p-8 text-center text-sm text-secondary">Loading feed status…</Card>;
  }

  const generated = new Date(data.generatedAt);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard variant="success" icon={<Icon name="inventory_2" />} label="Products in feed" value={String(data.productCount)} />
        <StatCard variant="dark" icon={<Icon name="schedule" />} label="Last generated" value={generated.toLocaleString()} />
        <StatCard
          variant={data.warnings.length > 0 ? "warning" : "success"}
          icon={<Icon name={data.warnings.length > 0 ? "warning" : "check_circle"} />}
          label="Data quality"
          value={data.warnings.length > 0 ? `${data.warnings.length} issue(s)` : "Clean"}
        />
      </div>

      <Card className="flex flex-col gap-3 p-5">
        <div>
          <h3 className="font-ui text-sm font-bold text-text">Catalog Data Feed URLs</h3>
          <p className="mt-0.5 text-xs text-secondary">
            Paste these into each platform. They are public and always current — every platform
            re-fetches on its own schedule, so there is nothing to upload or re-send after a price change.
          </p>
        </div>

        <FeedRow label="Meta Feed" url={data.metaUrl} />
        <FeedRow label="Google Feed" url={data.googleUrl} />
        <FeedRow label="TikTok Feed" url={data.tiktokUrl} />

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Button
            type="button"
            variant="primary"
            disabled={refresh.isPending}
            onClick={() => refresh.mutate()}
          >
            {refresh.isPending ? "Rebuilding…" : "Refresh Feed Now"}
          </Button>
          <span className="text-xs text-secondary">
            Rebuilds immediately. Normally unnecessary — the feed already rebuilds on every product
            save, and on a 30-minute schedule.
          </span>
        </div>
      </Card>

      {(data.warnings.length > 0 || data.skipped.length > 0) && (
        <Card className="flex flex-col gap-3 p-5">
          <div>
            <h3 className="font-ui text-sm font-bold text-text">Data quality</h3>
            <p className="mt-0.5 text-xs text-secondary">
              Fixed on the product, not here. Left alone, the platforms reject these rows.
            </p>
          </div>

          {data.warnings.map((w) => (
            <div key={w.reason} className="rounded-inner border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                {w.count} product(s) — {w.reason}
              </p>
              {w.productIds && w.productIds.length > 0 && (
                <p className="mt-1 font-mono text-[11px] text-secondary">
                  ids: {w.productIds.join(", ")}
                  {w.count > w.productIds.length ? ` … +${w.count - w.productIds.length} more` : ""}
                </p>
              )}
            </div>
          ))}

          {data.skipped.map((s) => (
            <div key={s.reason} className="rounded-inner border border-border bg-surface-2 px-3 py-2.5">
              <p className="text-xs font-semibold text-text">
                {s.count} product(s) left out — {s.reason}
              </p>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
