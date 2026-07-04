import type { Connection } from 'mysql2/promise';
import type { PrismaClient } from '../../src/index';
import {
  blogCategoryPath,
  blogPostPath,
  blogTagPath,
  brandPath,
  categoryPath,
  pagePath,
  productPath,
  tagPath,
} from '@amader/shared';
import { loadSlugMap, oldPath } from './slugs';
import { bump, type MigrationReport } from './report';

interface SeoMetaJson {
  seo_title?: string;
  seo_description?: string;
  seo_image?: string;
  index?: string;
}

async function upsertSeoMeta(
  prisma: PrismaClient,
  entityType:
    | 'PRODUCT'
    | 'CATEGORY'
    | 'BRAND'
    | 'TAG'
    | 'BLOG_POST'
    | 'BLOG_CATEGORY'
    | 'PAGE',
  entityId: number,
  json: SeoMetaJson,
): Promise<void> {
  await prisma.seoMeta.upsert({
    where: { entityType_entityId_locale: { entityType, entityId, locale: 'EN' } },
    create: {
      entityType,
      entityId,
      locale: 'EN',
      title: json.seo_title || null,
      description: json.seo_description || null,
      ogImageUrl: json.seo_image ? `legacy://${json.seo_image}` : null,
      robots: json.index === 'noindex' ? 'noindex,nofollow' : 'index,follow',
    },
    update: {},
  });
}

export async function migrateSeoMeta(
  source: Connection,
  prisma: PrismaClient,
  report: MigrationReport,
  maps: {
    brandId: Map<number, number>;
    categoryId: Map<number, number>;
    productTagId: Map<number, number>;
    productId: Map<number, number>;
    blogCategoryId: Map<number, number>;
    pageId: Map<number, number>;
  },
): Promise<void> {
  const [rows] = await source.query<any[]>(
    "SELECT * FROM meta_boxes WHERE meta_key = 'seo_meta'",
  );
  bump(report, 'seo_meta', 'source', rows.length);

  const referenceTypeConfig: Record<
    string,
    { entityType: Parameters<typeof upsertSeoMeta>[1]; idMap: Map<number, number> } | undefined
  > = {
    'Botble\\Ecommerce\\Models\\Product': { entityType: 'PRODUCT', idMap: maps.productId },
    'Botble\\Ecommerce\\Models\\ProductCategory': { entityType: 'CATEGORY', idMap: maps.categoryId },
    'Botble\\Ecommerce\\Models\\Brand': { entityType: 'BRAND', idMap: maps.brandId },
    'Botble\\Ecommerce\\Models\\ProductTag': { entityType: 'TAG', idMap: maps.productTagId },
    'Botble\\Blog\\Models\\Post': { entityType: 'BLOG_POST', idMap: new Map() }, // resolved via BlogPost.legacyId below
    'Botble\\Blog\\Models\\Category': { entityType: 'BLOG_CATEGORY', idMap: maps.blogCategoryId },
    'Botble\\Page\\Models\\Page': { entityType: 'PAGE', idMap: maps.pageId },
  };

  for (const row of rows) {
    let json: SeoMetaJson;
    try {
      const parsed = JSON.parse(row.meta_value);
      json = Array.isArray(parsed) ? parsed[0] : parsed;
    } catch {
      bump(report, 'seo_meta', 'skipped');
      continue;
    }

    if (row.reference_type === 'Botble\\Blog\\Models\\Tag') {
      // No BLOG_TAG value in the SeoEntityType enum (B10 schema gap, not
      // something to patch mid-ETL without confirming a schema change first).
      bump(report, 'seo_meta', 'skipped');
      continue;
    }

    if (row.reference_type === 'Botble\\Blog\\Models\\Post') {
      const post = await prisma.blogPost.findUnique({ where: { legacyId: row.reference_id } });
      if (!post) {
        bump(report, 'seo_meta', 'skipped');
        continue;
      }
      await upsertSeoMeta(prisma, 'BLOG_POST', post.id, json);
      bump(report, 'seo_meta', 'migrated');
      continue;
    }

    const config = referenceTypeConfig[row.reference_type];
    const newId = config?.idMap.get(row.reference_id);
    if (!config || !newId) {
      bump(report, 'seo_meta', 'skipped');
      continue;
    }
    await upsertSeoMeta(prisma, config.entityType, newId, json);
    bump(report, 'seo_meta', 'migrated');
  }
}

async function createRedirectIfDifferent(
  prisma: PrismaClient,
  fromPath: string,
  toPath: string,
  report: MigrationReport,
): Promise<void> {
  if (fromPath === toPath) {
    report.redirectsSkippedAlreadyMatching += 1;
    return;
  }
  await prisma.redirect.upsert({
    where: { fromPath },
    create: { fromPath, toPath },
    update: { toPath },
  });
  report.redirectsCreated += 1;
}

// Old and new URL conventions differ for nearly every entity type (confirmed
// against the real slugs.prefix data — see the B12 plan). Every one of the
// ~1,900 legacy slugs gets a Redirect row unless its old and new path are
// already identical.
export async function migrateRedirects(
  source: Connection,
  prisma: PrismaClient,
  report: MigrationReport,
): Promise<void> {
  const [brandSlugs, tagSlugs, blogCategorySlugs, blogTagSlugs, postSlugs, pageSlugs] =
    await Promise.all([
      loadSlugMap(source, 'Botble\\Ecommerce\\Models\\Brand'),
      loadSlugMap(source, 'Botble\\Ecommerce\\Models\\ProductTag'),
      loadSlugMap(source, 'Botble\\Blog\\Models\\Category'),
      loadSlugMap(source, 'Botble\\Blog\\Models\\Tag'),
      loadSlugMap(source, 'Botble\\Blog\\Models\\Post'),
      loadSlugMap(source, 'Botble\\Page\\Models\\Page'),
    ]);

  const brands = await prisma.brand.findMany({ where: { legacyId: { not: null } } });
  for (const b of brands) {
    await createRedirectIfDifferent(prisma, oldPath(brandSlugs.get(b.legacyId!), b.slug), brandPath(b.slug), report);
  }

  const categories = await prisma.category.findMany({ where: { legacyId: { not: null } } });
  for (const c of categories) {
    await createRedirectIfDifferent(prisma, `/product-categorie/${c.slug}`, categoryPath(c.slug), report);
  }

  const products = await prisma.product.findMany({ where: { legacyId: { not: null } } });
  for (const p of products) {
    await createRedirectIfDifferent(prisma, `/product/${p.slug}`, productPath(p.slug), report);
  }

  const tags = await prisma.tag.findMany({ where: { legacyId: { not: null } } });
  for (const t of tags) {
    await createRedirectIfDifferent(prisma, oldPath(tagSlugs.get(t.legacyId!), t.slug), tagPath(t.slug), report);
  }

  const blogCategories = await prisma.blogCategory.findMany({ where: { legacyId: { not: null } } });
  for (const c of blogCategories) {
    await createRedirectIfDifferent(
      prisma,
      oldPath(blogCategorySlugs.get(c.legacyId!), c.slug),
      blogCategoryPath(c.slug),
      report,
    );
  }

  const blogTags = await prisma.blogTag.findMany({ where: { legacyId: { not: null } } });
  for (const t of blogTags) {
    await createRedirectIfDifferent(
      prisma,
      oldPath(blogTagSlugs.get(t.legacyId!), t.slug),
      blogTagPath(t.slug),
      report,
    );
  }

  const posts = await prisma.blogPost.findMany({ where: { legacyId: { not: null } } });
  for (const p of posts) {
    await createRedirectIfDifferent(prisma, oldPath(postSlugs.get(p.legacyId!), p.slug), blogPostPath(p.slug), report);
  }

  const pages = await prisma.page.findMany({ where: { legacyId: { not: null } } });
  for (const p of pages) {
    await createRedirectIfDifferent(prisma, oldPath(pageSlugs.get(p.legacyId!), p.slug), pagePath(p.slug), report);
  }
}
