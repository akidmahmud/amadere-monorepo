"use client";

import { DefaultLink, type LinkComponent } from "../lib/link-component";

export interface BlogCardData {
  href: string;
  title: string;
  excerpt?: string | null;
  imageUrl?: string;
  categoryLabel?: string;
  authorName?: string;
  publishedAtLabel?: string;
  /** Real tracked views, or a stable per-post placeholder if the post has none yet — see toBlogCardData(). */
  viewCount?: number;
}

const eyeIcon = (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export interface BlogCardProps {
  post: BlogCardData;
  linkComponent?: LinkComponent;
}

export function BlogCard({ post, linkComponent: Link = DefaultLink }: BlogCardProps) {
  return (
    <div className="overflow-hidden rounded-brand border border-line bg-white shadow-brand">
      <Link href={post.href} className="block aspect-[16/10] bg-beige">
        {post.imageUrl && <img src={post.imageUrl} alt={post.title} className="h-full w-full object-cover" />}
      </Link>
      <div className="p-4">
        {post.categoryLabel && (
          <span className="mb-2 inline-block rounded-full bg-beige px-2.5 py-1 font-ui text-[11px] font-semibold uppercase tracking-wide text-gold-dark">
            {post.categoryLabel}
          </span>
        )}
        <Link href={post.href} className="mb-1.5 block font-serif text-base font-semibold leading-snug text-ink">
          {post.title}
        </Link>
        {post.excerpt && <p className="mb-3 line-clamp-2 font-body text-sm text-muted">{post.excerpt}</p>}
        {(post.authorName || post.publishedAtLabel || post.viewCount != null) && (
          <p className="flex items-center justify-between gap-2 font-ui text-xs text-muted">
            <span>
              {post.authorName}
              {post.authorName && post.publishedAtLabel && " · "}
              {post.publishedAtLabel}
            </span>
            {post.viewCount != null && (
              <span className="flex shrink-0 items-center gap-1">
                {eyeIcon}
                {post.viewCount.toLocaleString()}
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
