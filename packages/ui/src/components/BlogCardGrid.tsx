"use client";

import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { Carousel } from "./Carousel";

export interface BlogCardGridItem {
  href: string;
  title: string;
  imageUrl?: string;
  categoryLabel?: string;
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

export interface BlogCardGridProps {
  posts: BlogCardGridItem[];
  viewAllHref?: string;
  viewAllLabel?: string;
  linkComponent?: LinkComponent;
}

function BlogCard({
  post,
  className,
  linkComponent: Link = DefaultLink,
}: {
  post: BlogCardGridItem;
  className?: string;
  linkComponent?: LinkComponent;
}) {
  return (
    <Link href={post.href} className={`group block text-center ${className ?? ""}`}>
      <div className="mb-4 overflow-hidden rounded-2xl bg-gray">
        {post.imageUrl && (
          // Was aspect-[4/3] + object-cover — most real blog thumbnails are
          // square (measured live: 800x800, 1080x1080), but not guaranteed
          // to be exactly square every time, and any mismatch still cropped
          // image text/headlines. object-contain guarantees the full image
          // is always visible regardless of its real aspect ratio — a thin
          // letterbox bar beats cutting content off, per explicit request.
          <img
            src={post.imageUrl}
            alt={post.title}
            loading="lazy"
            className="aspect-square w-full object-contain transition-transform duration-300 group-hover:scale-105"
          />
        )}
      </div>
      {post.categoryLabel && <p className="mb-1.5 font-ui text-sm font-semibold text-muted">{post.categoryLabel}</p>}
      <h3 className="mb-1.5 line-clamp-2 font-serif text-lg font-semibold leading-snug text-ink group-hover:text-green">
        {post.title}
      </h3>
      {(post.publishedAtLabel || post.viewCount != null) && (
        <p className="flex items-center justify-center gap-2 font-ui text-sm text-muted">
          {post.publishedAtLabel}
          {post.publishedAtLabel && post.viewCount != null && <span aria-hidden>·</span>}
          {post.viewCount != null && (
            <span className="inline-flex items-center gap-1">
              {eyeIcon}
              {post.viewCount.toLocaleString()}
            </span>
          )}
        </p>
      )}
    </Link>
  );
}

// Matches amadere.com's homepage "Our Blog" section: uniform cards (image,
// category, title, date) rather than BentoBlogs' asymmetric featured-tile
// layout. Desktop is a static grid; mobile switches to the same horizontal
// Carousel used elsewhere on this page (Related Products, Categories) since
// a 1-per-row stacked list of these bigger cards would make the section
// very tall.
export function BlogCardGrid({ posts, viewAllHref, viewAllLabel = "View All", linkComponent: Link = DefaultLink }: BlogCardGridProps) {
  if (posts.length === 0) return null;

  return (
    <div>
      <div className="hidden md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-10 lg:grid-cols-4">
        {posts.map((post) => (
          <BlogCard key={post.href} post={post} linkComponent={Link} />
        ))}
      </div>

      <div className="md:hidden">
        <Carousel compactArrowsOnMobile>
          {posts.map((post) => (
            <BlogCard
              key={post.href}
              post={post}
              className="w-full shrink-0 snap-start sm:w-[calc(33.333%-12px)]"
              linkComponent={Link}
            />
          ))}
        </Carousel>
      </div>

      {viewAllHref && (
        <Link
          href={viewAllHref}
          className="mx-auto mt-8 flex w-fit items-center gap-2 rounded-full bg-green px-6 py-3 font-ui text-sm font-semibold text-white hover:bg-green-dark"
        >
          {viewAllLabel}
        </Link>
      )}
    </div>
  );
}
