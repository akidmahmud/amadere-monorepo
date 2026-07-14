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
}

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
        {(post.authorName || post.publishedAtLabel) && (
          <p className="font-ui text-xs text-muted">
            {post.authorName}
            {post.authorName && post.publishedAtLabel && " · "}
            {post.publishedAtLabel}
          </p>
        )}
      </div>
    </div>
  );
}
