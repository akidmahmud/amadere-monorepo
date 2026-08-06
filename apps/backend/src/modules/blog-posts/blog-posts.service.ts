import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ContentStatus, Locale } from '@amader/db';
import { PaginatedResult } from '@amader/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  paginationArgs,
  toPaginatedResult,
} from '../../common/pagination.util';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';
import { UpdateBlogPostDto } from './dto/update-blog-post.dto';
import {
  AdminBlogPostDto,
  AdminDeletedBlogPostDto,
  BLOG_POST_INCLUDE,
  BlogAuthorProfileDto,
  BlogPostRevisionDto,
  BlogPostWithRelations,
  PublicBlogPostDetailDto,
  toAdminBlogPostDto,
  toPublicBlogPostSummaryDto,
} from './blog-posts.mapper';
import { computeSeoScore, extractToc } from './content.util';
import {
  LinkCandidate,
  LinkSuggestion,
  suggestInternalLinks,
} from './internal-links.util';
import { SeoService } from '../seo/seo.service';
import { TokenService } from '../../common/auth/token.service';
import {
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
} from '../../common/structured-data/structured-data.util';

const RELATED_POSTS_LIMIT = 5;

@Injectable()
export class BlogPostsService {
  private readonly logger = new Logger(BlogPostsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly seo: SeoService,
    private readonly tokens: TokenService,
  ) {}

  async adminList(
    page: number,
    pageSize: number,
    status?: ContentStatus,
    authorId?: number,
    q?: string,
    categoryId?: number,
    tagId?: number,
    isFeatured?: boolean,
  ) {
    const where = {
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(authorId !== undefined ? { adminUserId: authorId } : {}),
      ...(isFeatured !== undefined ? { isFeatured } : {}),
      ...(categoryId !== undefined ? { categories: { some: { categoryId } } } : {}),
      ...(tagId !== undefined ? { tags: { some: { tagId } } } : {}),
      ...(q?.trim()
        ? {
            OR: [
              { slug: { contains: q.trim(), mode: 'insensitive' as const } },
              { translations: { some: { title: { contains: q.trim(), mode: 'insensitive' as const } } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.blogPost.findMany({
        where,
        include: BLOG_POST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.blogPost.count({ where }),
    ]);
    return toPaginatedResult(
      items.map(toAdminBlogPostDto),
      total,
      page,
      pageSize,
    );
  }

  async adminStats(): Promise<{ total: number; published: number; draft: number; archived: number; featured: number }> {
    const base = { deletedAt: null } as const;
    const [total, published, draft, archived, featured] = await Promise.all([
      this.prisma.client.blogPost.count({ where: base }),
      this.prisma.client.blogPost.count({ where: { ...base, status: 'PUBLISHED' } }),
      this.prisma.client.blogPost.count({ where: { ...base, status: 'DRAFT' } }),
      this.prisma.client.blogPost.count({ where: { ...base, status: 'ARCHIVED' } }),
      this.prisma.client.blogPost.count({ where: { ...base, isFeatured: true } }),
    ]);
    return { total, published, draft, archived, featured };
  }

  async adminGet(id: number): Promise<AdminBlogPostDto> {
    const post = await this.loadOrThrow(id);
    return toAdminBlogPostDto(post);
  }

  async create(
    dto: CreateBlogPostDto,
    authorId: number,
  ): Promise<AdminBlogPostDto> {
    await this.assertSlugAvailable(dto.slug);

    const post = await this.prisma.client.blogPost.create({
      data: {
        slug: dto.slug,
        adminUserId: authorId,
        imageUrl: dto.imageUrl,
        isFeatured: dto.isFeatured,
        categories: dto.categoryIds
          ? { create: dto.categoryIds.map((categoryId) => ({ categoryId })) }
          : undefined,
        tags: dto.tagIds
          ? { create: dto.tagIds.map((tagId) => ({ tagId })) }
          : undefined,
        translations: {
          create: dto.translations.map((t) => ({
            locale: t.locale,
            title: t.title,
            excerpt: t.excerpt,
            content: t.content,
            metaDescription: t.metaDescription,
            seoScore: computeSeoScore(t),
            faqs: t.faqs ? { create: t.faqs } : undefined,
          })),
        },
      },
      include: BLOG_POST_INCLUDE,
    });
    return toAdminBlogPostDto(post);
  }

  async update(
    id: number,
    dto: UpdateBlogPostDto,
    adminUserId?: number,
  ): Promise<AdminBlogPostDto> {
    const before = await this.loadOrThrow(id);
    if (dto.slug) await this.assertSlugAvailable(dto.slug, id);

    if (dto.translations) {
      await this.prisma.client.blogPostTranslation.deleteMany({
        where: { postId: id },
      });
    }
    if (dto.categoryIds) {
      await this.prisma.client.blogPostCategory.deleteMany({
        where: { postId: id },
      });
    }
    if (dto.tagIds) {
      await this.prisma.client.blogPostTag.deleteMany({
        where: { postId: id },
      });
    }

    const post = await this.prisma.client.blogPost.update({
      where: { id },
      data: {
        slug: dto.slug,
        imageUrl: dto.imageUrl,
        isFeatured: dto.isFeatured,
        categories: dto.categoryIds
          ? { create: dto.categoryIds.map((categoryId) => ({ categoryId })) }
          : undefined,
        tags: dto.tagIds
          ? { create: dto.tagIds.map((tagId) => ({ tagId })) }
          : undefined,
        translations: dto.translations
          ? {
              create: dto.translations.map((t) => ({
                locale: t.locale,
                title: t.title,
                excerpt: t.excerpt,
                content: t.content,
                metaDescription: t.metaDescription,
                seoScore: computeSeoScore(t),
                faqs: t.faqs ? { create: t.faqs } : undefined,
              })),
            }
          : undefined,
      },
      include: BLOG_POST_INCLUDE,
    });
    await this.recordRevisions(id, before, dto, adminUserId);
    return toAdminBlogPostDto(post);
  }

  // One row per changed field (matches the reference CMS's revision table),
  // not a full snapshot — most saves only touch a couple of fields. Only
  // compares fields actually present on the DTO (a PATCH is partial), so a
  // save that doesn't touch `slug` never logs a false "slug changed" row.
  private async recordRevisions(
    postId: number,
    before: BlogPostWithRelations,
    dto: UpdateBlogPostDto,
    adminUserId?: number,
  ): Promise<void> {
    const rows: { field: string; before: string | null; after: string | null }[] = [];
    const push = (field: string, beforeValue: string | null, afterValue: string | null) => {
      if (beforeValue !== afterValue) rows.push({ field, before: beforeValue, after: afterValue });
    };

    if (dto.slug !== undefined) push('slug', before.slug, dto.slug);
    if (dto.imageUrl !== undefined) push('imageUrl', before.imageUrl, dto.imageUrl ?? null);
    if (dto.isFeatured !== undefined) push('isFeatured', String(before.isFeatured), String(dto.isFeatured));

    if (dto.categoryIds !== undefined) {
      const beforeIds = before.categories.map((c) => c.categoryId).sort((a, b) => a - b);
      push('categoryIds', JSON.stringify(beforeIds), JSON.stringify([...dto.categoryIds].sort((a, b) => a - b)));
    }
    if (dto.tagIds !== undefined) {
      const beforeIds = before.tags.map((t) => t.tagId).sort((a, b) => a - b);
      push('tagIds', JSON.stringify(beforeIds), JSON.stringify([...dto.tagIds].sort((a, b) => a - b)));
    }

    if (dto.translations) {
      for (const t of dto.translations) {
        const beforeTranslation = before.translations.find((bt) => bt.locale === t.locale);
        push(`title (${t.locale})`, beforeTranslation?.title ?? null, t.title);
        push(`excerpt (${t.locale})`, beforeTranslation?.excerpt ?? null, t.excerpt ?? null);
        push(`content (${t.locale})`, beforeTranslation?.content ?? null, t.content);
        push(`metaDescription (${t.locale})`, beforeTranslation?.metaDescription ?? null, t.metaDescription ?? null);
      }
    }

    if (rows.length === 0) return;
    await this.prisma.client.blogPostRevision.createMany({
      data: rows.map((r) => ({ postId, adminUserId, ...r })),
    });
  }

  async generatePreviewToken(id: number): Promise<{ token: string }> {
    await this.loadOrThrow(id);
    const token = await this.tokens.signBlogPreviewToken(id);
    return { token };
  }

  async listRevisions(id: number): Promise<BlogPostRevisionDto[]> {
    const revisions = await this.prisma.client.blogPostRevision.findMany({
      where: { postId: id },
      include: { adminUser: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return revisions.map((r) => ({
      id: r.id,
      field: r.field,
      before: r.before,
      after: r.after,
      createdAt: r.createdAt,
      author: r.adminUser ? `${r.adminUser.firstName} ${r.adminUser.lastName}`.trim() : null,
    }));
  }

  async submitForReview(id: number): Promise<AdminBlogPostDto> {
    const post = await this.loadOrThrow(id);
    if (post.status !== 'DRAFT') {
      throw new ConflictException(
        'Only a draft post can be submitted for review',
      );
    }
    return this.setStatus(id, 'PENDING');
  }

  async publish(id: number): Promise<AdminBlogPostDto> {
    const post = await this.loadOrThrow(id);
    if (post.status !== 'DRAFT' && post.status !== 'PENDING') {
      throw new ConflictException(
        'Only a draft or pending post can be published',
      );
    }
    const updated = await this.prisma.client.blogPost.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: post.publishedAt ?? new Date(),
      },
      include: BLOG_POST_INCLUDE,
    });
    return toAdminBlogPostDto(updated);
  }

  async archive(id: number): Promise<AdminBlogPostDto> {
    await this.loadOrThrow(id);
    return this.setStatus(id, 'ARCHIVED');
  }

  async delete(id: number): Promise<void> {
    await this.loadOrThrow(id);
    await this.prisma.client.blogPost.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private static readonly TRASH_RETENTION_DAYS = 30;

  // Trash listing — soft-deleted posts still within the retention window
  // (the nightly purge job below removes anything older, so `deletedAt: not
  // null` alone is equivalent to "within 30 days" in practice). Same pattern
  // as ProductsService.listDeleted.
  async listDeleted(page = 1, pageSize = 20): Promise<PaginatedResult<AdminDeletedBlogPostDto>> {
    const where = { deletedAt: { not: null } };
    const [total, posts] = await Promise.all([
      this.prisma.client.blogPost.count({ where }),
      this.prisma.client.blogPost.findMany({
        where,
        select: {
          id: true,
          slug: true,
          imageUrl: true,
          deletedAt: true,
          translations: { select: { title: true }, take: 1 },
        },
        orderBy: { deletedAt: 'desc' },
        ...paginationArgs(page, pageSize),
      }),
    ]);

    const items = posts.map((p) => {
      const deletedAt = p.deletedAt!;
      const daysElapsed = Math.floor((Date.now() - deletedAt.getTime()) / 86_400_000);
      return {
        id: p.id,
        slug: p.slug,
        title: p.translations[0]?.title ?? p.slug,
        imageUrl: p.imageUrl,
        deletedAt,
        daysRemaining: Math.max(0, BlogPostsService.TRASH_RETENTION_DAYS - daysElapsed),
      };
    });
    return toPaginatedResult(items, total, page, pageSize);
  }

  async restore(id: number): Promise<AdminBlogPostDto> {
    const post = await this.prisma.client.blogPost.findUnique({
      where: { id },
      select: { deletedAt: true },
    });
    if (!post || post.deletedAt === null) {
      throw new NotFoundException('Blog post not found in trash');
    }
    await this.prisma.client.blogPost.update({
      where: { id },
      data: { deletedAt: null },
    });
    return this.adminGet(id);
  }

  // Runs daily — anything soft-deleted more than 30 days ago is gone for
  // good. Safe to hard-delete: cascades to BlogPostTranslation/Category/Tag/
  // Revision rows via each relation's onDelete: Cascade.
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpiredTrash(): Promise<number> {
    const cutoff = new Date(Date.now() - BlogPostsService.TRASH_RETENTION_DAYS * 86_400_000);
    const { count } = await this.prisma.client.blogPost.deleteMany({
      where: { deletedAt: { lt: cutoff } },
    });
    if (count > 0) this.logger.log(`Purged ${count} blog post(s) from trash (past 30-day retention).`);
    return count;
  }

  async publicList(
    locale: Locale,
    page: number,
    pageSize: number,
    categorySlug?: string,
    tagSlug?: string,
    authorId?: number,
  ) {
    const where = {
      deletedAt: null,
      status: 'PUBLISHED' as const,
      ...(categorySlug
        ? { categories: { some: { category: { slug: categorySlug } } } }
        : {}),
      ...(tagSlug ? { tags: { some: { tag: { slug: tagSlug } } } } : {}),
      ...(authorId !== undefined ? { adminUserId: authorId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.blogPost.findMany({
        where,
        include: BLOG_POST_INCLUDE,
        orderBy: { publishedAt: 'desc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.blogPost.count({ where }),
    ]);
    return toPaginatedResult(
      items.map((p) => toPublicBlogPostSummaryDto(p, locale)),
      total,
      page,
      pageSize,
    );
  }

  async publicGetBySlug(
    slug: string,
    locale: Locale,
    previewToken?: string,
  ): Promise<PublicBlogPostDetailDto> {
    // A draft/pending post is only reachable here if the caller presents a
    // valid preview token minted for THIS specific post — a valid token for
    // post 5 doesn't unlock post 6. An invalid/expired token isn't a hard
    // auth error; it just falls back to the normal published-only lookup
    // (so an expired preview link 404s the same way a wrong slug would,
    // instead of leaking "this post exists but you're unauthorized").
    let allowUnpublished: number | null = null;
    if (previewToken) {
      try {
        const payload = await this.tokens.verifyBlogPreviewToken(previewToken);
        allowUnpublished = payload.postId;
      } catch {
        allowUnpublished = null;
      }
    }

    const post = await this.prisma.client.blogPost.findFirst({
      where: {
        slug,
        deletedAt: null,
        ...(allowUnpublished ? {} : { status: 'PUBLISHED' }),
      },
      include: BLOG_POST_INCLUDE,
    });
    if (!post) throw new NotFoundException('Post not found');
    if (allowUnpublished && post.id !== allowUnpublished) {
      throw new NotFoundException('Post not found');
    }

    if (post.status === 'PUBLISHED') {
      await this.prisma.client.blogPost.update({
        where: { id: post.id },
        data: { viewCount: { increment: 1 } },
      });
    }

    const translation =
      post.translations.find((t) => t.locale === locale) ??
      post.translations[0];
    const { content, toc } = extractToc(translation?.content ?? '');
    const relatedPosts = await this.findRelatedPosts(post, locale);
    const summary = toPublicBlogPostSummaryDto(post, locale);
    const faqs = (translation?.faqs ?? []).map((f) => ({
      question: f.question,
      answer: f.answer,
    }));

    const seo = await this.seo.resolve('BLOG_POST', post.id, locale, {
      title: summary.title,
      description: translation?.metaDescription ?? summary.excerpt,
      canonicalPath: `/blog/${post.slug}`,
      imageUrl: post.imageUrl,
    });

    const faqJsonLd = buildFaqPageJsonLd(faqs);
    const structuredData = [
      buildArticleJsonLd({
        headline: summary.title,
        description: seo.description,
        imageUrl: post.imageUrl,
        authorName:
          `${post.author.firstName ?? ''} ${post.author.lastName ?? ''}`.trim(),
        datePublished: post.publishedAt,
        dateModified: post.updatedAt,
        canonicalUrl: seo.canonicalUrl,
      }),
      buildBreadcrumbJsonLd([
        { name: 'Home', url: this.seo.absoluteUrl('/') },
        { name: 'Blog', url: this.seo.absoluteUrl('/blog') },
        { name: summary.title, url: seo.canonicalUrl },
      ]),
      ...(faqJsonLd ? [faqJsonLd] : []),
    ];

    return {
      ...summary,
      content,
      metaDescription: translation?.metaDescription ?? null,
      toc,
      faqs,
      relatedPosts,
      seo,
      structuredData,
    };
  }

  async internalLinkSuggestions(
    id: number,
    locale: Locale,
  ): Promise<LinkSuggestion[]> {
    const post = await this.loadOrThrow(id);
    const translation =
      post.translations.find((t) => t.locale === locale) ??
      post.translations[0];
    if (!translation)
      throw new BadRequestException(`Post has no ${locale} translation`);

    const [otherPosts, products] = await Promise.all([
      this.prisma.client.blogPost.findMany({
        where: { deletedAt: null, status: 'PUBLISHED', id: { not: id } },
        include: { translations: { where: { locale } } },
        take: 100,
        orderBy: { publishedAt: 'desc' },
      }),
      this.prisma.client.product.findMany({
        where: { deletedAt: null, status: 'PUBLISHED' },
        include: { translations: { where: { locale } } },
        take: 200,
        orderBy: { isFeatured: 'desc' },
      }),
    ]);

    const candidates: LinkCandidate[] = [
      ...otherPosts
        .filter((p) => p.translations[0])
        .map((p) => ({
          type: 'post' as const,
          title: p.translations[0].title,
          url: `/blog/${p.slug}`,
        })),
      ...products
        .filter((p) => p.translations[0])
        .map((p) => ({
          type: 'product' as const,
          title: p.translations[0].name,
          url: `/products/${p.slug}`,
        })),
    ];

    return suggestInternalLinks(translation.content, candidates);
  }

  async authorProfile(
    authorId: number,
    locale: Locale,
    page: number,
    pageSize: number,
  ): Promise<BlogAuthorProfileDto> {
    const author = await this.prisma.client.adminUser.findUnique({
      where: { id: authorId },
      select: { id: true, firstName: true, lastName: true, avatarUrl: true },
    });
    if (!author) throw new NotFoundException('Author not found');

    const posts = await this.publicList(
      locale,
      page,
      pageSize,
      undefined,
      undefined,
      authorId,
    );
    return { author, posts };
  }

  private async findRelatedPosts(post: BlogPostWithRelations, locale: Locale) {
    const categoryIds = post.categories.map((c) => c.categoryId);
    const tagIds = post.tags.map((t) => t.tagId);
    if (categoryIds.length === 0 && tagIds.length === 0) return [];

    const related = await this.prisma.client.blogPost.findMany({
      where: {
        id: { not: post.id },
        deletedAt: null,
        status: 'PUBLISHED',
        OR: [
          ...(categoryIds.length
            ? [{ categories: { some: { categoryId: { in: categoryIds } } } }]
            : []),
          ...(tagIds.length
            ? [{ tags: { some: { tagId: { in: tagIds } } } }]
            : []),
        ],
      },
      include: BLOG_POST_INCLUDE,
      orderBy: { publishedAt: 'desc' },
      take: RELATED_POSTS_LIMIT,
    });
    return related.map((p) => toPublicBlogPostSummaryDto(p, locale));
  }

  private async setStatus(
    id: number,
    status: ContentStatus,
  ): Promise<AdminBlogPostDto> {
    const post = await this.prisma.client.blogPost.update({
      where: { id },
      data: { status },
      include: BLOG_POST_INCLUDE,
    });
    return toAdminBlogPostDto(post);
  }

  private async loadOrThrow(id: number): Promise<BlogPostWithRelations> {
    const post = await this.prisma.client.blogPost.findFirst({
      where: { id, deletedAt: null },
      include: BLOG_POST_INCLUDE,
    });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  private async assertSlugAvailable(
    slug: string,
    excludeId?: number,
  ): Promise<void> {
    const existing = await this.prisma.client.blogPost.findUnique({
      where: { slug },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Slug "${slug}" is already in use`);
    }
  }
}
