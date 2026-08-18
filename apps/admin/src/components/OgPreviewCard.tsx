"use client";

// Mimics the link-preview card WhatsApp/Messenger/Discord/Facebook render
// from a page's Open Graph tags — same "big image, bold title, description,
// domain" shape those apps actually use, so an admin can see what a shared
// link will look like without actually sharing it anywhere. Shared by the
// Site SEO Settings page (site-wide fallback) and the per-product SEO tab
// (per-product override) — same visual contract, different data source.
export function OgPreviewCard({
  imageUrl,
  title,
  description,
  domain,
}: {
  imageUrl?: string;
  title: string;
  description: string;
  domain: string;
}) {
  return (
    <div className="w-full max-w-sm overflow-hidden rounded-inner border border-border bg-surface shadow-card">
      <div className="aspect-[1.91/1] w-full bg-surface-2">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-xs text-muted">No image selected</div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 p-3">
        <span className="truncate text-xs uppercase tracking-wide text-muted">{domain}</span>
        <span className="truncate text-sm font-bold text-text">{title || "Your title"}</span>
        <span className="line-clamp-2 text-xs text-secondary">
          {description || "Your description will appear here."}
        </span>
      </div>
    </div>
  );
}
