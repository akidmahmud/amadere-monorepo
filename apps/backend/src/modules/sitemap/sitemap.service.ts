import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  blogCategoryPath,
  blogPostPath,
  blogTagPath,
  brandPath,
  categoryPath,
  pagePath,
  productBundlePath,
  productPath,
  tagPath,
} from '@amader/shared';
import { PrismaService } from '../../common/prisma/prisma.service';

interface SitemapUrl {
  path: string;
  lastmod: Date;
}

const PUBLISHED = { status: 'PUBLISHED' as const };

@Injectable()
export class SitemapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async buildXml(): Promise<string> {
    const baseUrl = this.config.get<string>('STOREFRONT_BASE_URL') ?? '';
    const urls = await this.collectUrls();

    const body = urls
      .map(
        (u) =>
          `  <url><loc>${escapeXml(baseUrl + u.path)}</loc><lastmod>${u.lastmod.toISOString()}</lastmod></url>`,
      )
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
  }

  buildRobotsTxt(): string {
    const baseUrl = this.config.get<string>('STOREFRONT_BASE_URL') ?? '';
    return [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin',
      'Disallow: /api/',
      `Sitemap: ${baseUrl}/sitemap.xml`,
      '',
    ].join('\n');
  }

  private async collectUrls(): Promise<SitemapUrl[]> {
    const [
      products,
      categories,
      brands,
      tags,
      bundles,
      posts,
      blogCategories,
      blogTags,
      pages,
    ] = await Promise.all([
      this.prisma.client.product.findMany({
        where: { ...PUBLISHED, deletedAt: null },
        select: { slug: true, updatedAt: true },
      }),
      this.prisma.client.category.findMany({
        where: { ...PUBLISHED, deletedAt: null },
        select: { slug: true, updatedAt: true },
      }),
      this.prisma.client.brand.findMany({
        where: { ...PUBLISHED, deletedAt: null },
        select: { slug: true, updatedAt: true },
      }),
      this.prisma.client.tag.findMany({
        where: { ...PUBLISHED, deletedAt: null },
        select: { slug: true, updatedAt: true },
      }),
      this.prisma.client.productBundle.findMany({
        where: PUBLISHED,
        select: { slug: true, updatedAt: true },
      }),
      this.prisma.client.blogPost.findMany({
        where: { ...PUBLISHED, deletedAt: null },
        select: { slug: true, updatedAt: true },
      }),
      this.prisma.client.blogCategory.findMany({
        where: PUBLISHED,
        select: { slug: true, updatedAt: true },
      }),
      this.prisma.client.blogTag.findMany({
        where: PUBLISHED,
        select: { slug: true, createdAt: true },
      }),
      this.prisma.client.page.findMany({
        where: { ...PUBLISHED, deletedAt: null },
        select: { slug: true, updatedAt: true },
      }),
    ]);

    return [
      { path: '/', lastmod: new Date() },
      ...products.map((p) => ({
        path: productPath(p.slug),
        lastmod: p.updatedAt,
      })),
      ...categories.map((c) => ({
        path: categoryPath(c.slug),
        lastmod: c.updatedAt,
      })),
      ...brands.map((b) => ({ path: brandPath(b.slug), lastmod: b.updatedAt })),
      ...tags.map((t) => ({ path: tagPath(t.slug), lastmod: t.updatedAt })),
      ...bundles.map((b) => ({
        path: productBundlePath(b.slug),
        lastmod: b.updatedAt,
      })),
      ...posts.map((p) => ({
        path: blogPostPath(p.slug),
        lastmod: p.updatedAt,
      })),
      ...blogCategories.map((c) => ({
        path: blogCategoryPath(c.slug),
        lastmod: c.updatedAt,
      })),
      ...blogTags.map((t) => ({
        path: blogTagPath(t.slug),
        lastmod: t.createdAt,
      })),
      ...pages.map((p) => ({ path: pagePath(p.slug), lastmod: p.updatedAt })),
    ];
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
