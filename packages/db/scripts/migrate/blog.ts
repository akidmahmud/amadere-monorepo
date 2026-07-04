import type { Connection } from 'mysql2/promise';
import type { PrismaClient } from '../../src/index';
import { loadSlugMap, oldPath } from './slugs';
import { bump, type MigrationReport } from './report';

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-') || `item-${Date.now()}`
  );
}

function mapStatus(legacyStatus: string): 'DRAFT' | 'PUBLISHED' {
  return legacyStatus === 'published' ? 'PUBLISHED' : 'DRAFT';
}

export async function migrateBlogCategories(
  source: Connection,
  prisma: PrismaClient,
  report: MigrationReport,
): Promise<Map<number, number>> {
  const [rows] = await source.query<any[]>('SELECT * FROM categories');
  const slugs = await loadSlugMap(source, 'Botble\\Blog\\Models\\Category');
  const idMap = new Map<number, number>();
  bump(report, 'blog_categories', 'source', rows.length);

  for (const row of rows) {
    const legacy = slugs.get(row.id);
    const slug = legacy?.slug ?? slugify(row.name);
    const category = await prisma.blogCategory.upsert({
      where: { legacyId: row.id },
      create: {
        legacyId: row.id,
        slug,
        legacySlug: oldPath(legacy, slug),
        sortOrder: row.order ?? 0,
        status: mapStatus(row.status),
        translations: {
          create: [
            { locale: 'EN', name: row.name, description: row.description },
            { locale: 'BN', name: row.name, description: row.description },
          ],
        },
      },
      update: { slug, status: mapStatus(row.status) },
    });
    idMap.set(row.id, category.id);
    bump(report, 'blog_categories', 'migrated');
  }

  for (const row of rows) {
    if (row.parent_id && idMap.has(row.parent_id)) {
      await prisma.blogCategory.update({
        where: { id: idMap.get(row.id)! },
        data: { parentId: idMap.get(row.parent_id)! },
      });
    }
  }

  return idMap;
}

export async function migrateBlogTags(
  source: Connection,
  prisma: PrismaClient,
  report: MigrationReport,
): Promise<Map<number, number>> {
  const [rows] = await source.query<any[]>('SELECT * FROM tags');
  const slugs = await loadSlugMap(source, 'Botble\\Blog\\Models\\Tag');
  const idMap = new Map<number, number>();
  bump(report, 'blog_tags', 'source', rows.length);

  for (const row of rows) {
    const legacy = slugs.get(row.id);
    const slug = legacy?.slug ?? slugify(row.name);
    const tag = await prisma.blogTag.upsert({
      where: { legacyId: row.id },
      create: {
        legacyId: row.id,
        slug,
        legacySlug: oldPath(legacy, slug),
        status: mapStatus(row.status),
        translations: {
          create: [
            { locale: 'EN', name: row.name },
            { locale: 'BN', name: row.name },
          ],
        },
      },
      update: { slug, status: mapStatus(row.status) },
    });
    idMap.set(row.id, tag.id);
    bump(report, 'blog_tags', 'migrated');
  }
  return idMap;
}

export async function migrateBlogPosts(
  source: Connection,
  prisma: PrismaClient,
  report: MigrationReport,
  authorAdminUserId: number,
  categoryId: Map<number, number>,
  tagId: Map<number, number>,
): Promise<void> {
  const [rows] = await source.query<any[]>('SELECT * FROM posts');
  const slugs = await loadSlugMap(source, 'Botble\\Blog\\Models\\Post');
  const [categoryLinks] = await source.query<any[]>('SELECT * FROM post_categories');
  const [tagLinks] = await source.query<any[]>('SELECT * FROM post_tags');
  bump(report, 'blog_posts', 'source', rows.length);

  for (const row of rows) {
    const legacy = slugs.get(row.id);
    const slug = legacy?.slug ?? slugify(row.name);
    const post = await prisma.blogPost.upsert({
      where: { legacyId: row.id },
      create: {
        legacyId: row.id,
        slug,
        legacySlug: oldPath(legacy, slug),
        adminUserId: authorAdminUserId,
        status: mapStatus(row.status),
        isFeatured: !!row.is_featured,
        imageUrl: row.image ? `legacy://${row.image}` : null,
        publishedAt: row.status === 'published' ? row.created_at : null,
        viewCount: row.views ?? 0,
        translations: {
          create: [
            {
              locale: 'EN',
              title: row.name,
              excerpt: row.description,
              content: row.content ?? '',
            },
            {
              locale: 'BN',
              title: row.name,
              excerpt: row.description,
              content: row.content ?? '',
            },
          ],
        },
      },
      update: {
        slug,
        status: mapStatus(row.status),
        isFeatured: !!row.is_featured,
        viewCount: row.views ?? 0,
      },
    });
    bump(report, 'blog_posts', 'migrated');

    for (const link of categoryLinks.filter((l) => l.post_id === row.id)) {
      const newCategoryId = categoryId.get(link.category_id);
      if (!newCategoryId) continue;
      await prisma.blogPostCategory.upsert({
        where: { postId_categoryId: { postId: post.id, categoryId: newCategoryId } },
        create: { postId: post.id, categoryId: newCategoryId },
        update: {},
      });
    }
    for (const link of tagLinks.filter((l) => l.post_id === row.id)) {
      const newTagId = tagId.get(link.tag_id);
      if (!newTagId) continue;
      await prisma.blogPostTag.upsert({
        where: { postId_tagId: { postId: post.id, tagId: newTagId } },
        create: { postId: post.id, tagId: newTagId },
        update: {},
      });
    }
  }
}

export async function migratePages(
  source: Connection,
  prisma: PrismaClient,
  report: MigrationReport,
): Promise<void> {
  const [rows] = await source.query<any[]>('SELECT * FROM pages');
  const slugs = await loadSlugMap(source, 'Botble\\Page\\Models\\Page');
  bump(report, 'pages', 'source', rows.length);

  for (const row of rows) {
    const legacy = slugs.get(row.id);
    const slug = legacy?.slug ?? slugify(row.name);
    await prisma.page.upsert({
      where: { legacyId: row.id },
      create: {
        legacyId: row.id,
        slug,
        legacySlug: oldPath(legacy, slug),
        status: mapStatus(row.status),
        translations: {
          create: [
            { locale: 'EN', title: row.name, content: row.content ?? '' },
            { locale: 'BN', title: row.name, content: row.content ?? '' },
          ],
        },
      },
      update: { slug, status: mapStatus(row.status) },
    });
    bump(report, 'pages', 'migrated');
  }
}

export async function migrateNewsletter(
  source: Connection,
  prisma: PrismaClient,
  report: MigrationReport,
): Promise<void> {
  const [rows] = await source.query<any[]>('SELECT * FROM newsletters');
  bump(report, 'newsletter_subscribers', 'source', rows.length);

  for (const row of rows) {
    await prisma.newsletterSubscriber.upsert({
      where: { email: row.email },
      create: {
        email: row.email,
        status: row.status === 'unsubscribed' ? 'UNSUBSCRIBED' : 'SUBSCRIBED',
        subscribedAt: row.created_at ?? new Date(),
      },
      update: {},
    });
    bump(report, 'newsletter_subscribers', 'migrated');
  }
}
