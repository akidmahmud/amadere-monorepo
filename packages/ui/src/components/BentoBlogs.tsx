"use client";

import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { cn } from "../lib/cn";

export interface BentoBlogItem {
  href: string;
  title: string;
  imageUrl?: string;
}

export interface BentoBlogsProps {
  /** Up to 5 posts — the asymmetric bento grid is tuned for exactly that many. */
  posts: BentoBlogItem[];
  linkComponent?: LinkComponent;
}

const cellClasses = [
  "col-start-1 col-span-1 row-start-1 row-span-6", // left, tall
  "col-start-2 col-span-1 row-start-1 row-span-3", // center, top
  "col-start-3 col-span-1 row-start-1 row-span-2", // right 1
  "col-start-3 col-span-1 row-start-3 row-span-2", // right 2
  "col-start-3 col-span-1 row-start-5 row-span-2", // right 3
];

function BentoTile({
  post,
  className,
  linkComponent: Link = DefaultLink,
}: {
  post: BentoBlogItem;
  className: string;
  linkComponent?: LinkComponent;
}) {
  return (
    <Link href={post.href} className={cn("group relative block overflow-hidden rounded-brand bg-gray", className)}>
      {post.imageUrl && (
        <img
          src={post.imageUrl}
          alt={post.title}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      )}
      <span className="absolute inset-x-0 bottom-0 line-clamp-2 bg-gradient-to-t from-black/60 to-transparent p-3 font-ui text-[13px] font-medium text-white">
        {post.title}
      </span>
    </Link>
  );
}

export function BentoBlogs({ posts, linkComponent }: BentoBlogsProps) {
  if (posts.length === 0) return null;

  return (
    <div
      className="grid grid-cols-[1.4fr_1.3fr_1fr] gap-4"
      style={{ gridTemplateRows: "repeat(6, 38px)" }}
    >
      {posts.slice(0, 5).map((post, i) => (
        <BentoTile key={post.href} post={post} className={cellClasses[i]} linkComponent={linkComponent} />
      ))}
    </div>
  );
}
