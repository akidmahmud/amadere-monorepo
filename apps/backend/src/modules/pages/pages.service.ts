import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Locale, Prisma } from '@amader/db';
import {
  checkReservedSlug,
  validatePageDocument,
} from '@amader/page-builder/validate';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  paginationArgs,
  toPaginatedResult,
} from '../../common/pagination.util';
import { SeoService } from '../seo/seo.service';
import { TokenService } from '../../common/auth/token.service';
import { RevalidationService } from '../../common/revalidation/revalidation.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import {
  AdminPageDto,
  PublicPageDetailDto,
  toAdminPageDto,
  toPublicPageDto,
} from './pages.mapper';

const WITH_TRANSLATIONS = { translations: true } as const;

@Injectable()
export class PagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seo: SeoService,
    private readonly revalidation: RevalidationService,
    private readonly tokens: TokenService,
  ) {}

  async adminList(page: number, pageSize: number, q?: string) {
    const trimmed = q?.trim();
    const where = {
      deletedAt: null,
      ...(trimmed
        ? {
            OR: [
              { slug: { contains: trimmed, mode: 'insensitive' as const } },
              { translations: { some: { title: { contains: trimmed, mode: 'insensitive' as const } } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.page.findMany({
        where,
        include: WITH_TRANSLATIONS,
        orderBy: { id: 'asc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.page.count({ where }),
    ]);
    return toPaginatedResult(items.map(toAdminPageDto), total, page, pageSize);
  }

  async adminGet(id: number): Promise<AdminPageDto> {
    const page = await this.prisma.client.page.findFirst({
      where: { id, deletedAt: null },
      include: WITH_TRANSLATIONS,
    });
    if (!page) throw new NotFoundException('Page not found');
    return toAdminPageDto(page);
  }

  async create(dto: CreatePageDto): Promise<AdminPageDto> {
    await this.assertSlugAvailable(dto.slug);
    const page = await this.prisma.client.page.create({
      data: {
        slug: dto.slug,
        status: dto.status,
        translations: { create: dto.translations },
      },
      include: WITH_TRANSLATIONS,
    });
    return toAdminPageDto(page);
  }

  async update(id: number, dto: UpdatePageDto): Promise<AdminPageDto> {
    await this.adminGet(id);
    if (dto.slug) await this.assertSlugAvailable(dto.slug, id);

    if (dto.translations) {
      await this.prisma.client.pageTranslation.deleteMany({
        where: { pageId: id },
      });
    }

    const page = await this.prisma.client.page.update({
      where: { id },
      data: {
        slug: dto.slug,
        status: dto.status,
        translations: dto.translations
          ? { create: dto.translations }
          : undefined,
      },
      include: WITH_TRANSLATIONS,
    });
    return toAdminPageDto(page);
  }

  async delete(id: number): Promise<void> {
    await this.adminGet(id);
    await this.prisma.client.page.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async publicGetBySlug(
    slug: string,
    locale: Locale,
    previewToken?: string,
  ): Promise<PublicPageDetailDto> {
    const page = await this.prisma.client.page.findFirst({
      // A draft page is reachable only with a valid preview token; without one
      // the PUBLISHED filter stands, so an expired link 404s exactly as a
      // wrong slug would rather than leaking that the page exists.
      where: previewToken
        ? { slug, deletedAt: null }
        : { slug, deletedAt: null, status: 'PUBLISHED' },
      include: WITH_TRANSLATIONS,
    });
    if (!page) throw new NotFoundException('Page not found');

    let dto = toPublicPageDto(page, locale);

    if (previewToken) {
      try {
        const payload = await this.tokens.verifyPagePreviewToken(previewToken);
        // Scoped check: a valid token minted for another page must not unlock
        // this one's draft.
        if (payload.pageId === page.id) {
          const translation =
            page.translations.find((t) => t.locale === locale) ??
            page.translations[0];
          const draft = translation?.draftLayout ?? translation?.layout ?? null;
          dto = { ...dto, layout: draft };
        }
      } catch {
        // Invalid or expired token: fall through to the published view rather
        // than erroring, so a stale link still shows the live page.
      }
    }
    const seo = await this.seo.resolve('PAGE', page.id, locale, {
      title: dto.title,
      canonicalPath: `/${dto.slug}`,
    });
    return { ...dto, seo };
  }

  // ---------------------------------------------------------------
  // Page builder (plan section 6)
  // ---------------------------------------------------------------

  /**
   * Autosaved draft. Never validated and never rendered publicly — the whole
   * point of a draft is that it may be mid-edit and broken.
   */
  async saveDraftLayout(
    id: number,
    locale: Locale,
    layout: unknown,
  ): Promise<{ success: true }> {
    await this.adminGet(id);
    await this.prisma.client.pageTranslation.update({
      where: { pageId_locale: { pageId: id, locale } },
      data: { draftLayout: layout as Prisma.InputJsonValue },
    });
    return { success: true };
  }

  /**
   * Validate, snapshot the outgoing layout, publish, revalidate.
   *
   * Order matters: the snapshot is written BEFORE the overwrite, or a bad
   * publish would destroy the only copy of the layout it replaced — which is
   * exactly the moment rollback is needed.
   */
  async publishLayout(
    id: number,
    locale: Locale,
    expectedKind: 'CONTENT' | 'CHECKOUT',
    label?: string,
    adminUserId?: number,
  ): Promise<{ success: true }> {
    const page = await this.prisma.client.page.findFirst({
      where: { id, deletedAt: null },
      include: WITH_TRANSLATIONS,
    });
    if (!page) throw new NotFoundException('Page not found');

    // The caller's permission was checked against `expectedKind` by the route
    // it came in on. Refusing a mismatch here is what stops someone with only
    // page.update publishing a checkout layout through the content route.
    if (page.kind !== expectedKind) {
      throw new UnprocessableEntityException(
        page.kind === 'CHECKOUT'
          ? 'This is a checkout page - publish it from the checkout publish endpoint.'
          : 'This is a content page - publish it from the standard publish endpoint.',
      );
    }

    const translation = page.translations.find((t) => t.locale === locale);
    if (!translation) {
      throw new NotFoundException(
        `Page has no ${locale} translation to publish`,
      );
    }

    const candidate = translation.draftLayout ?? translation.layout;
    if (!candidate) {
      throw new UnprocessableEntityException(
        'Nothing to publish - no draft layout saved.',
      );
    }

    const result = validatePageDocument(candidate, page.kind);
    if (!result.ok) {
      // 422 listing every problem at once, so the owner fixes them in one
      // pass rather than rediscovering the next one on each retry.
      throw new UnprocessableEntityException({
        message: 'Layout failed validation',
        // `details`, not `errors`: HttpExceptionFilter only forwards a
        // property named `details` onto the response. Named anything else the
        // reasons are dropped and the admin shows a bare "failed validation"
        // with nothing actionable in it.
        details: result.errors,
      });
    }

    await this.prisma.client.$transaction(async (tx) => {
      if (translation.layout) {
        await tx.pageRevision.create({
          data: {
            pageId: id,
            locale,
            layout: translation.layout as Prisma.InputJsonValue,
            label: label ?? null,
            createdBy: adminUserId ?? null,
          },
        });
      }
      await tx.pageTranslation.update({
        where: { pageId_locale: { pageId: id, locale } },
        data: {
          layout: candidate as Prisma.InputJsonValue,
          // Prisma.DbNull, not null: for a nullable Json column, a bare
          // null is ambiguous between SQL NULL and the JSON value `null`,
          // so the client refuses it and asks which one you meant.
          draftLayout: Prisma.DbNull,
        },
      });
    });

    await this.revalidatePage(page.slug, page.kind === 'CHECKOUT');
    return { success: true };
  }

  /**
   * A short-lived link that shows the UNPUBLISHED draft on the real
   * storefront. Never exposes the draft on a public cacheable URL (plan
   * §6.3): the layout is only returned when this token is presented, and the
   * token is scoped to one page id so it cannot be pointed at another.
   */
  async generatePreviewToken(id: number): Promise<{ token: string }> {
    await this.adminGet(id);
    return { token: await this.tokens.signPagePreviewToken(id) };
  }

  async listRevisions(id: number, locale?: Locale) {
    await this.adminGet(id);
    return this.prisma.client.pageRevision.findMany({
      where: { pageId: id, ...(locale ? { locale } : {}) },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        locale: true,
        label: true,
        createdAt: true,
        createdBy: true,
      },
      take: 50,
    });
  }

  /**
   * Roll back to a snapshot. Re-validated rather than trusted: the block
   * registry may have changed since the snapshot was taken, and restoring a
   * layout referencing a since-removed block would break the page just as
   * badly as publishing a bad one.
   */
  async restoreRevision(
    id: number,
    revisionId: number,
  ): Promise<{ success: true }> {
    const page = await this.prisma.client.page.findFirst({
      where: { id, deletedAt: null },
    });
    if (!page) throw new NotFoundException('Page not found');

    const revision = await this.prisma.client.pageRevision.findFirst({
      where: { id: revisionId, pageId: id },
    });
    if (!revision) throw new NotFoundException('Revision not found');

    const result = validatePageDocument(revision.layout, page.kind);
    if (!result.ok) {
      throw new UnprocessableEntityException({
        message: 'That revision is no longer valid and cannot be restored',
        details: result.errors,
      });
    }

    await this.prisma.client.pageTranslation.update({
      where: { pageId_locale: { pageId: id, locale: revision.locale } },
      data: {
        layout: revision.layout as Prisma.InputJsonValue,
        // Prisma.DbNull for the same reason as in publishLayout: a bare null
        // on a nullable Json column is ambiguous and the client rejects it.
        draftLayout: Prisma.DbNull,
      },
    });

    await this.revalidatePage(page.slug, page.kind === 'CHECKOUT');
    return { success: true };
  }

  /**
   * Make this page the live checkout. Clearing every other flag happens in
   * the same transaction - two live checkouts would make which one customers
   * see depend on row order.
   */
  async setDefaultCheckout(id: number): Promise<{ success: true }> {
    const page = await this.prisma.client.page.findFirst({
      where: { id, deletedAt: null },
    });
    if (!page) throw new NotFoundException('Page not found');
    if (page.kind !== 'CHECKOUT') {
      throw new UnprocessableEntityException(
        'Only a checkout page can be set as the live checkout',
      );
    }

    await this.prisma.client.$transaction([
      this.prisma.client.page.updateMany({
        where: { isDefaultCheckout: true, NOT: { id } },
        data: { isDefaultCheckout: false },
      }),
      this.prisma.client.page.update({
        where: { id },
        data: { isDefaultCheckout: true },
      }),
    ]);

    await this.revalidatePage(page.slug, true);
    return { success: true };
  }

  /**
   * Clears the live checkout so /checkout falls back to the hardcoded layout
   * in code. This is the owner's undo when a published layout misbehaves.
   */
  async clearDefaultCheckout(): Promise<{ success: true }> {
    await this.prisma.client.page.updateMany({
      where: { isDefaultCheckout: true },
      data: { isDefaultCheckout: false },
    });
    await this.revalidatePage(null, true);
    return { success: true };
  }

  /**
   * The layout /checkout renders, or null. Never throws - a failure here must
   * degrade to the code fallback, not take the page down.
   */
  async getActiveCheckoutLayout(
    locale: Locale,
  ): Promise<{ layout: unknown | null }> {
    try {
      const page = await this.prisma.client.page.findFirst({
        where: {
          isDefaultCheckout: true,
          deletedAt: null,
          status: 'PUBLISHED',
        },
        include: WITH_TRANSLATIONS,
      });
      if (!page) return { layout: null };

      const translation =
        page.translations.find((t) => t.locale === locale) ??
        page.translations[0];
      const layout = translation?.layout ?? null;
      if (!layout) return { layout: null };

      // Validated on read as well as on write. A layout can go stale after
      // publish (a block removed in a later deploy), and the storefront must
      // not be the thing that discovers it.
      return validatePageDocument(layout, 'CHECKOUT').ok
        ? { layout }
        : { layout: null };
    } catch {
      return { layout: null };
    }
  }

  /**
   * Fire-and-forget ISR revalidation. Both locales, because a layout change
   * affects the page in every language it exists in.
   */
  private async revalidatePage(
    slug: string | null,
    isCheckout: boolean,
  ): Promise<void> {
    const paths: string[] = [];
    for (const prefix of ['', '/bn']) {
      if (slug) paths.push(`${prefix}/${slug}`);
      if (isCheckout) paths.push(`${prefix}/checkout`);
    }
    if (paths.length > 0) await this.revalidation.revalidate(paths, 'page');
  }

  private async assertSlugAvailable(
    slug: string,
    excludeId?: number,
  ): Promise<void> {
    // Reserved-route check first (plan §6.2.2): a page claiming "checkout"
    // would shadow the real route, and finding that out only when a customer
    // cannot pay is far too late.
    const reserved = checkReservedSlug(slug);
    if (reserved) throw new ConflictException(reserved);

    const existing = await this.prisma.client.page.findUnique({
      where: { slug },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Slug "${slug}" is already in use`);
    }
  }
}
