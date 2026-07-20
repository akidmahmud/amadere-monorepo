"use client";

import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { cn } from "../lib/cn";

export interface BentoBlogItem {
  href: string;
  title: string;
  imageUrl?: string;
  categoryLabel?: string;
  publishedAtLabel?: string;
}

export interface BentoBlogsProps {
  /** Up to 6 posts — the bento grid (1 featured + 2 stacked + 3 in a row) is tuned for exactly that many. */
  posts: BentoBlogItem[];
  viewAllHref?: string;
  viewAllLabel?: string;
  linkComponent?: LinkComponent;
}

const calendarIcon = (
  <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M3 10h18" />
  </svg>
);

const docIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6M9 13h6M9 17h6" />
  </svg>
);

const clockIcon = (
  <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </svg>
);

// No backend field for real reading time exists yet — every post shows the
// same placeholder value per explicit request, not a computed estimate.
const READING_TIME_LABEL = "৫ মিনিট পড়ুন";

function BentoTile({
  post,
  className,
  big,
  linkComponent: Link = DefaultLink,
}: {
  post: BentoBlogItem;
  className?: string;
  big?: boolean;
  linkComponent?: LinkComponent;
}) {
  return (
    <Link href={post.href} className={cn("group relative block overflow-hidden rounded-2xl bg-gray", className)}>
      {post.imageUrl && (
        <img src={post.imageUrl} alt={post.title} loading="lazy" className="h-full w-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-4">
        <h3
          className={cn(
            "mb-2 line-clamp-2 font-serif font-semibold text-white",
            big ? "text-2xl leading-tight" : "text-[15px] leading-snug",
          )}
        >
          {post.title}
        </h3>
        <div className="flex items-center gap-3 font-ui text-[11px] text-white/90">
          {post.publishedAtLabel && (
            <span className="inline-flex items-center gap-1">
              {calendarIcon}
              {post.publishedAtLabel}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            {clockIcon}
            {READING_TIME_LABEL}
          </span>
          {post.categoryLabel && (
            <span className="ml-auto rounded-full bg-beige px-2.5 py-1 font-semibold text-gold-dark">
              {post.categoryLabel}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function BentoBlogs({ posts, viewAllHref, viewAllLabel = "View All", linkComponent: Link = DefaultLink }: BentoBlogsProps) {
  if (posts.length === 0) return null;
  const items = posts.slice(0, 6);

  return (
    <div>
      {/* Desktop: 1 featured tile + 2 stacked beside it, then 3 in a row below.
          Explicit pixel heights throughout (not grid/flex stretch) — the
          stacked pair is 430px total minus one 16px gap, split in half. */}
      <div className="hidden lg:block">
        <div className="grid grid-cols-2 gap-4">
          <BentoTile post={items[0]} className="h-[430px]" big linkComponent={Link} />
          {items.length > 1 && (
            <div className="flex flex-col gap-4">
              {items.slice(1, 3).map((post) => (
                <BentoTile key={post.href} post={post} className="h-[207px]" linkComponent={Link} />
              ))}
            </div>
          )}
        </div>
        {items.length > 3 && (
          <div className="mt-4 grid grid-cols-3 gap-4">
            {items.slice(3, 6).map((post) => (
              <BentoTile key={post.href} post={post} className="h-[220px]" linkComponent={Link} />
            ))}
          </div>
        )}
      </div>

      {/* Mobile/tablet: plain stacked list, same tiles. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:hidden">
        {items.map((post) => (
          <BentoTile key={post.href} post={post} className="aspect-[16/10]" linkComponent={Link} />
        ))}
      </div>

      {viewAllHref && (
        <Link
          href={viewAllHref}
          className="mx-auto mt-8 flex w-fit items-center gap-2 rounded-full bg-green px-6 py-3 font-ui text-sm font-semibold text-white hover:bg-green-dark"
        >
          {docIcon}
          {viewAllLabel}
        </Link>
      )}
    </div>
  );
}
