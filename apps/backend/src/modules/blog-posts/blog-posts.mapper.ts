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

export class BlogPostAuthorDto {
  id!: number;
  firstName!: string | null;
  lastName!: string | null;
  avatarUrl!: string | null;
}

export class BlogPostFaqDto {
  question!: string;
  answer!: string;
  sortOrder!: number;
}

export class AdminBlogPostTranslationDto {
  locale!: Locale;
  title!: string;
  excerpt!: string | null;
  content!: string;
  metaDescription!: string | null;
  seoScore!: number | null;
  faqs!: BlogPostFaqDto[];
}

export class AdminBlogPostDto {
  id!: number;
  slug!: string;
  status!: ContentStatus;
  isFeatured!: boolean;
  sortOrder!: number;
  imageUrl!: string | null;
  coverImageUrl!: string | null;
  publishedAt!: Date | null;
  viewCount!: number;
  author!: BlogPostAuthorDto;
  categoryIds!: number[];
  tagIds!: number[];
  translations!: AdminBlogPostTranslationDto[];
  createdAt!: Date;
}

// Trash listing — deliberately minimal, same rationale as
// AdminDeletedProductDto (a 100-row trash list doesn't need every
// translation/category/tag).
export class AdminDeletedBlogPostDto {
  id!: number;
  slug!: string;
  title!: string;
  imageUrl!: string | null;
  deletedAt!: Date;
  /** Days until the nightly purge job permanently deletes this row (see
   * BlogPostsService.purgeExpiredTrash) — floored at 0, never negative. */
  daysRemaining!: number;
}

export class BlogPostRevisionDto {
  id!: number;
  field!: string;
  before!: string | null;
  after!: string | null;
  createdAt!: Date;
  author!: string | null;
}

export function toAdminBlogPostDto(
  post: BlogPostWithRelations,
): AdminBlogPostDto {
  return {
    id: post.id,
    slug: post.slug,
    status: post.status,
    isFeatured: post.isFeatured,
    sortOrder: post.sortOrder,
    imageUrl: post.imageUrl,
    coverImageUrl: post.coverImageUrl,
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

export class PublicBlogPostAuthorDto {
  id!: number;
  firstName!: string | null;
  lastName!: string | null;
  avatarUrl!: string | null;
}

export class BlogPostCategorySummaryDto {
  slug!: string;
  name!: string;
}

export class BlogPostTagSummaryDto {
  slug!: string;
  name!: string;
}

export class PublicBlogPostSummaryDto {
  id!: number;
  slug!: string;
  title!: string;
  excerpt!: string | null;
  imageUrl!: string | null;
  publishedAt!: Date | null;
  viewCount!: number;
  author!: PublicBlogPostAuthorDto;
  categories!: BlogPostCategorySummaryDto[];
  tags!: BlogPostTagSummaryDto[];
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
    viewCount: post.viewCount,
    author: {
      id: post.author.id,
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

export class BlogPostTocEntryDto {
  level!: number;
  text!: string;
  anchor!: string;
}

export class BlogPostFaqPublicDto {
  question!: string;
  answer!: string;
}

export class PublicBlogPostDetailDto extends PublicBlogPostSummaryDto {
  // Wide hero banner for the article's own page — distinct from the
  // inherited `imageUrl` (small card thumbnail, used by listings/related
  // posts, never the hero). Already resolved to fall back to `imageUrl`
  // when unset — see blog-posts.service.ts#publicGetBySlug.
  coverImageUrl!: string | null;
  content!: string;
  metaDescription!: string | null;
  toc!: BlogPostTocEntryDto[];
  faqs!: BlogPostFaqPublicDto[];
  relatedPosts!: PublicBlogPostSummaryDto[];
  seo!: ResolvedSeoDto;
  structuredData!: Record<string, unknown>[];
}

export class BlogAuthorSummaryDto {
  id!: number;
  firstName!: string | null;
  lastName!: string | null;
  avatarUrl!: string | null;
}

export class BlogAuthorPostsPageDto {
  items!: PublicBlogPostSummaryDto[];
  total!: number;
  page!: number;
  pageSize!: number;
}

export class BlogAuthorProfileDto {
  author!: BlogAuthorSummaryDto;
  posts!: BlogAuthorPostsPageDto;
}
