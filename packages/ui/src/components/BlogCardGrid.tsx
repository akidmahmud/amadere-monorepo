"use client";

import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { Carousel } from "./Carousel";

export interface BlogCardGridItem {
  href: string;
  title: string;
  imageUrl?: string;
  categoryLabel?: string;
  publishedAtLabel?: string;
}

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
          <img
            src={post.imageUrl}
            alt={post.title}
            loading="lazy"
            className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}
      </div>
      {post.categoryLabel && <p className="mb-1.5 font-ui text-sm font-semibold text-muted">{post.categoryLabel}</p>}
      <h3 className="mb-1.5 line-clamp-2 font-serif text-lg font-semibold leading-snug text-ink group-hover:text-green">
        {post.title}
      </h3>
      {post.publishedAtLabel && <p className="font-ui text-sm text-muted">{post.publishedAtLabel}</p>}
    </Link>
  );
}

// Matches amadere.com's homepage "Our Blog" section: uniform cards (image,
// category, title, date) rather than BentoBlogs' asymmetric featured-tile
// layout. Desktop is a static grid; mobile switches to the same horizontal
// Carousel used elsewhere on this page (Related Products, Categories) since
// a 1-per-row stacked list of these bigger cards would make the section
// very tall. No view-count shown — this codebase doesn't track post views
// (confirmed against blog-mapper.ts), and a fabricated number would be
// worse than omitting it.
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
