import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { PrismaService } from '../../common/prisma/prisma.service';
import { SitemapSettingsService } from './sitemap-settings.service';

interface SitemapUrl {
  path: string;
  lastmod: Date;
}

const PUBLISHED = { status: 'PUBLISHED' as const };
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

@Injectable()
export class SitemapService {
  private readonly logger = new Logger(SitemapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly settings: SitemapSettingsService,
  ) {}

  async getUrlCount(): Promise<number> {
    return (await this.collectUrls()).length;
  }

  // Real IndexNow ping (https://www.indexnow.org) — Bing/Yandex/Seznam/
  // Naver support this open protocol for near-instant re-crawl requests,
  // unlike Google which has no public equivalent. Manual/on-demand rather
  // than wired into every content create/update across the app (products,
  // blog posts, pages, ...) — that would touch a couple dozen call sites
  // for automatic-on-every-save behavior; this button covers the same real
  // value (notifying search engines the site changed) without that reach.
  async pingIndexNow(): Promise<{ success: boolean; message: string }> {
    const settings = await this.settings.getSettings();
    if (!settings.indexNowEnabled || !settings.indexNowKey) {
      return { success: false, message: 'IndexNow is not enabled or has no key configured.' };
    }
    const baseUrl = this.config.get<string>('STOREFRONT_BASE_URL') ?? '';
    let host: string;
    try {
      host = new URL(baseUrl).host;
    } catch {
      return { success: false, message: 'STOREFRONT_BASE_URL is not a valid URL.' };
    }
    const urls = await this.collectUrls();
    const urlList = urls.map((u) => baseUrl + u.path);

    try {
      const res = await fetch(INDEXNOW_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          host,
          key: settings.indexNowKey,
          keyLocation: `${baseUrl}/${settings.indexNowKey}.txt`,
          urlList,
        }),
      });
      if (res.ok) {
        return { success: true, message: `Notified search engines about ${urlList.length} URLs.` };
      }
      return { success: false, message: `IndexNow responded with HTTP ${res.status}.` };
    } catch (err) {
      this.logger.warn(`IndexNow ping failed: ${err instanceof Error ? err.message : String(err)}`);
      return { success: false, message: err instanceof Error ? err.message : 'Network error contacting IndexNow.' };
    }
  }

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
