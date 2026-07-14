import type { components } from "./api/schema";
import { toDisplayImageUrl } from "./media";

type PublicBlogPostSummaryDto = components["schemas"]["PublicBlogPostSummaryDto"];

export function formatBlogDate(date: string | null): string | undefined {
  if (!date) return undefined;
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" }).format(new Date(date));
}

export function toBlogCardData(post: PublicBlogPostSummaryDto) {
  const authorName = [post.author.firstName, post.author.lastName].filter(Boolean).join(" ") || undefined;
  return {
    href: `/blog/${post.slug}`,
    title: post.title,
    excerpt: post.excerpt,
    imageUrl: toDisplayImageUrl(post.imageUrl),
    categoryLabel: post.categories[0]?.name,
    authorName,
    publishedAtLabel: formatBlogDate(post.publishedAt),
  };
}
