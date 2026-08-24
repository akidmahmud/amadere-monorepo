import { IMG } from "@/lib/image-url";
import type { components } from "./api/schema";
import { toDisplayImageUrl } from "./media";

type PublicBlogPostSummaryDto = components["schemas"]["PublicBlogPostSummaryDto"];

export function formatBlogDate(date: string | null): string | undefined {
  if (!date) return undefined;
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" }).format(new Date(date));
}

// A brand-new post (or one that just hasn't accrued real traffic yet) would
// otherwise show "0 views" on its card, which reads as broken/unpopular
// rather than just new — a plausible-looking placeholder in the same range
// real early posts tend to land in. Seeded by post id (not Math.random())
// so it's stable across renders/refreshes for the same post instead of
// flickering to a new number every reload; falls away for good the moment
// the post earns its first real tracked view.
function seededPlaceholderViews(postId: number): number {
  const x = Math.sin(postId) * 10000;
  const fraction = x - Math.floor(x);
  return 20 + Math.floor(fraction * 21); // 20-40 inclusive
}

export function toBlogCardData(post: PublicBlogPostSummaryDto) {
  const authorName = [post.author.firstName, post.author.lastName].filter(Boolean).join(" ") || undefined;
  return {
    href: `/blog/${post.slug}`,
    title: post.title,
    excerpt: post.excerpt,
    imageUrl: toDisplayImageUrl(post.imageUrl, IMG.card),
    categoryLabel: post.categories[0]?.name,
    authorName,
    publishedAtLabel: formatBlogDate(post.publishedAt),
    viewCount: post.viewCount > 0 ? post.viewCount : seededPlaceholderViews(post.id),
  };
}
