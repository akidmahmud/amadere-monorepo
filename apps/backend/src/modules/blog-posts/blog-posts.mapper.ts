import { ContentStatus, Locale, Prisma } from '@amader/db';
import type { ResolvedSeoDto } from '../seo/seo.mapper';

export const BLOG_POST_INCLUDE = {
  author: {
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  },
  translations: {
    include: { faqs: { orderBy: { sortOrder: 'asc' as const } } },
  },
  categories: { include: { category: { include: { translations: true } } } },
  tags: { include: { tag: { include: { translations: true } } } },
} as const;

export type BlogPostWithRelations = Prisma.BlogPostGetPayload<{
  include: typeof BLOG_POST_INCLUDE;
}>;

function resolveTranslation<T extends { locale: Locale }>(
  translations: T[],
  locale: Locale,
): T | undefined {
  return translations.find((t) => t.locale === locale) ?? translations[0];
}

export interface AdminBlogPostDto {
  id: number;
  slug: string;
  status: ContentStatus;
  isFeatured: boolean;
  imageUrl: string | null;
  publishedAt: Date | null;
  viewCount: number;
  author: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
  };
  categoryIds: number[];
  tagIds: number[];
  translations: {
    locale: Locale;
    title: string;
    excerpt: string | null;
    content: string;
    metaDescription: string | null;
    seoScore: number | null;
    faqs: { question: string; answer: string; sortOrder: number }[];
  }[];
  createdAt: Date;
}

export function toAdminBlogPostDto(
  post: BlogPostWithRelations,
): AdminBlogPostDto {
  return {
    id: post.id,
    slug: post.slug,
    status: post.status,
    isFeatured: post.isFeatured,
    imageUrl: post.imageUrl,
    publishedAt: post.publishedAt,
    viewCount: post.viewCount,
    author: post.author,
    categoryIds: post.categories.map((c) => c.categoryId),
    tagIds: post.tags.map((t) => t.tagId),
    translations: post.translations.map((t) => ({
      locale: t.locale,
      title: t.title,
      excerpt: t.excerpt,
      content: t.content,
      metaDescription: t.metaDescription,
      seoScore: t.seoScore,
      faqs: t.faqs.map((f) => ({
        question: f.question,
        answer: f.answer,
        sortOrder: f.sortOrder,
      })),
    })),
    createdAt: post.createdAt,
  };
}

export interface PublicBlogPostSummaryDto {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  imageUrl: string | null;
  publishedAt: Date | null;
  author: {
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
  };
  categories: { slug: string; name: string }[];
  tags: { slug: string; name: string }[];
}

export function toPublicBlogPostSummaryDto(
  post: BlogPostWithRelations,
  locale: Locale,
): PublicBlogPostSummaryDto {
  const translation = resolveTranslation(post.translations, locale);
  return {
    id: post.id,
    slug: post.slug,
    title: translation?.title ?? post.slug,
    excerpt: translation?.excerpt ?? null,
    imageUrl: post.imageUrl,
    publishedAt: post.publishedAt,
    author: {
      firstName: post.author.firstName,
      lastName: post.author.lastName,
      avatarUrl: post.author.avatarUrl,
    },
    categories: post.categories.map((c) => {
      const t = resolveTranslation(c.category.translations, locale);
      return { slug: c.category.slug, name: t?.name ?? c.category.slug };
    }),
    tags: post.tags.map((pt) => {
      const t = resolveTranslation(pt.tag.translations, locale);
      return { slug: pt.tag.slug, name: t?.name ?? pt.tag.slug };
    }),
  };
}

export interface PublicBlogPostDetailDto extends PublicBlogPostSummaryDto {
  content: string;
  metaDescription: string | null;
  toc: { level: number; text: string; anchor: string }[];
  faqs: { question: string; answer: string }[];
  relatedPosts: PublicBlogPostSummaryDto[];
  seo: ResolvedSeoDto;
  structuredData: Record<string, unknown>[];
}
