"use client";

import { useLocale } from "next-intl";
import { AppLink } from "@/components/AppLink";
import { toApiLocale } from "@/lib/api-locale";
import { toDisplayImageUrl, IMG } from "@/lib/media";
import { downloadUrl, useDownloads, type DigitalDownloadItem } from "@/hooks/useDownloads";

function fileSizeLabel(bytes: number | null): string | null {
  if (!bytes || bytes <= 0) return null;
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function productName(item: DigitalDownloadItem, locale: "EN" | "BN"): string {
  const translations = item.product.translations ?? [];
  return (translations.find((t) => t.locale === locale) ?? translations[0])?.name ?? item.product.slug;
}

export function DownloadsList() {
  const locale = toApiLocale(useLocale());
  const { data, isLoading, isError } = useDownloads();

  if (isLoading) return <p className="font-body text-sm text-muted">Loading…</p>;
  if (isError) return <p className="font-body text-sm text-red-600">Couldn&apos;t load your downloads.</p>;
  if (!data || data.length === 0) {
    return (
      <div>
        <h2 className="mb-4 font-ui text-[15px] font-semibold text-green">My Downloads</h2>
        <p className="font-body text-sm text-muted">
          You don&apos;t have any downloads yet —{" "}
          <AppLink href="/products" className="text-green underline">
            browse products
          </AppLink>{" "}
          to find one.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4 font-ui text-[15px] font-semibold text-green">My Downloads</h2>
      <div className="space-y-3">
        {data.map((item) => {
          const cover = toDisplayImageUrl(item.product.media?.[0]?.media.url, IMG.thumb);
          const size = fileSizeLabel(item.product.digitalFileSize);
          return (
            <div
              key={item.id}
              className="flex items-center gap-4 rounded-brand border border-line bg-white p-4 max-sm:flex-col max-sm:items-start"
            >
              <div className="h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-beige">
                {cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <AppLink
                  href={`/products/${item.product.slug}`}
                  className="font-ui text-sm font-semibold text-ink hover:text-green"
                >
                  {productName(item, locale)}
                </AppLink>
                <p className="mt-1 font-body text-xs text-muted">
                  Purchased {new Date(item.createdAt).toLocaleDateString()}
                  {size ? ` · ${size}` : ""}
                  {item.product.digitalPageCount ? ` · ${item.product.digitalPageCount} pages` : ""}
                </p>
                <p className="mt-0.5 font-body text-xs text-muted">
                  Downloaded {item.downloadCount} {item.downloadCount === 1 ? "time" : "times"}
                </p>
              </div>
              {/* A plain anchor, not a Button/router push: this URL streams a
                  PDF straight from the backend's token-gated endpoint, so it
                  must be a real navigation the browser can hand to its
                  download manager. */}
              <a
                href={downloadUrl(item.token)}
                className="shrink-0 rounded-lg bg-green px-4 py-2.5 font-ui text-sm font-semibold text-white hover:opacity-90"
              >
                Download
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
