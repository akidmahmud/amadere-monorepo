import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { PermissionCheck } from '../../common/auth/permission.decorator';
import { ProductsService } from '../products/products.service';
import { ProductCostHistoryService } from '../product-cost-history/product-cost-history.service';
import { PosProductDto, StorePriceDto } from './dto/pos-product.dto';

/**
 * The POS's own product screen: simple (no-variant) products that belong to
 * one store only. Goes through ProductsService so every product rule
 * (barcode, SKU, store-only = ADMIN_ONLY) still applies; the website product
 * form is not needed for store products.
 */
@Injectable()
export class PosProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
    private readonly costs: ProductCostHistoryService,
  ) {}

  async list(storeId: number) {
    const rows = await this.prisma.client.product.findMany({
      where: { storeId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        sku: true,
        barcode: true,
        price: true,
        salePrice: true,
        costPerItem: true,
        hasVariants: true,
        shippableWeight: true,
        weightUnit: true,
        translations: { select: { locale: true, name: true } },
        categories: { select: { categoryId: true } },
        media: {
          orderBy: { sortOrder: 'asc' },
          take: 1,
          select: {
            mediaId: true,
            media: { select: { url: true, cardUrl: true } },
          },
        },
      },
    });
    return rows.map(
      ({ translations, categories, media, shippableWeight, ...p }) => ({
        ...p,
        weightKg: shippableWeight?.toString() ?? null,
        name:
          translations.find((t) => t.locale === 'EN')?.name ??
          translations[0]?.name ??
          '',
        categoryId: categories[0]?.categoryId ?? null,
        mediaId: media[0]?.mediaId ?? null,
        imageUrl: media[0]?.media.cardUrl ?? media[0]?.media.url ?? null,
      }),
    );
  }

  /** POS Settings › Deleted SKUs & barcodes (all deleted products). */
  deletedCodes(q?: string) {
    return this.products.deletedCodes(q);
  }

  freeCodes(productId: number) {
    return this.products.freeCodes(productId);
  }

  async create(
    storeId: number,
    dto: PosProductDto,
    actor: { storeId: number | null; can: PermissionCheck },
  ) {
    // ponytail: random suffix keeps slugs unique without a lookup loop; the
    // slug is never public (store-only products are ADMIN_ONLY).
    const slug = `${slugify(dto.name)}-${randomBytes(3).toString('hex')}`;
    const created = await this.products.create(
      {
        ...this.fields(dto),
        slug,
        storeId,
        status: 'ADMIN_ONLY',
        trackInventory: true,
        excludeFromFeed: true,
      },
      actor,
    );
    await this.setUnit(created.id, dto);
    return created;
  }

  async update(
    storeId: number,
    id: number,
    dto: PosProductDto,
    actor: { storeId: number | null; can: PermissionCheck },
  ) {
    const p = await this.prisma.client.product.findUniqueOrThrow({
      where: { id },
      select: { storeId: true, hasVariants: true },
    });
    if (p.storeId !== storeId)
      throw new ForbiddenException(
        'This product does not belong to this store',
      );
    if (p.hasVariants)
      throw new ForbiddenException(
        'Products with variants are edited from the main Products page',
      );
    const updated = await this.products.update(id, this.fields(dto), actor);
    await this.setUnit(id, dto);
    return updated;
  }

  /**
   * Moves one of this store's own products to the product Trash (restorable
   * for 30 days from Products › Trash). Past sales keep their snapshots.
   */
  async remove(storeId: number, id: number) {
    const p = await this.prisma.client.product.findUniqueOrThrow({
      where: { id },
      select: { storeId: true },
    });
    if (p.storeId !== storeId)
      throw new ForbiddenException(
        'This product does not belong to this store',
      );
    await this.products.delete(id);
    return { deleted: true };
  }

  /**
   * Removes a SHARED product from this store only: not listed or sold here,
   * still on the website and at other stores. (A store's own product is
   * deleted with remove() instead.)
   */
  async hide(storeId: number, productId: number, adminId: number) {
    const c = this.prisma.client;
    const p = await c.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { storeId: true },
    });
    if (!p) throw new BadRequestException('Product not found');
    if (p.storeId !== null)
      throw new BadRequestException(
        'This is a store product — delete it instead',
      );
    const where = { storeId, productId, variantId: null };
    const existing = await c.storePrice.findFirst({ where });
    if (existing)
      await c.storePrice.update({
        where: { id: existing.id },
        data: { hidden: true, updatedById: adminId },
      });
    else
      await c.storePrice.create({
        data: { ...where, hidden: true, updatedById: adminId },
      });
    return { hidden: true };
  }

  /** Puts a removed product back on this store's till. */
  async unhide(storeId: number, productId: number) {
    const c = this.prisma.client;
    const where = { storeId, productId, variantId: null };
    // A row that only existed to hide the product goes; one that also holds
    // this store's name/price keeps them.
    await c.storePrice.deleteMany({
      where: {
        ...where,
        hidden: true,
        name: null,
        price: null,
        weightKg: null,
        mediaId: null,
      },
    });
    await c.storePrice.updateMany({ where, data: { hidden: false } });
    return { hidden: false };
  }

  /** Shared products removed from this store (to put back). */
  async hiddenList(storeId: number) {
    const rows = await this.prisma.client.storePrice.findMany({
      where: { storeId, variantId: null, hidden: true },
      select: {
        productId: true,
        updatedAt: true,
        product: {
          select: {
            sku: true,
            translations: { select: { locale: true, name: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((r) => ({
      productId: r.productId,
      sku: r.product.sku,
      name:
        r.product.translations.find((t) => t.locale === 'EN')?.name ??
        r.product.translations[0]?.name ??
        '',
      removedAt: r.updatedAt,
    }));
  }

  /** This store's deleted own products (Products Trash keeps them 30 days). */
  async deletedList(storeId: number) {
    const rows = await this.prisma.client.product.findMany({
      where: { storeId, deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      select: {
        id: true,
        sku: true,
        deletedAt: true,
        translations: { select: { locale: true, name: true } },
      },
    });
    return rows.map(({ translations, ...p }) => ({
      ...p,
      name:
        translations.find((t) => t.locale === 'EN')?.name ??
        translations[0]?.name ??
        '',
    }));
  }

  /** Back from the Trash, onto this store's till again. */
  async restore(storeId: number, id: number) {
    const p = await this.prisma.client.product.findUniqueOrThrow({
      where: { id },
      select: { storeId: true },
    });
    if (p.storeId !== storeId)
      throw new ForbiddenException(
        'This product does not belong to this store',
      );
    await this.products.restore(id);
    return { restored: true };
  }

  /**
   * Copy a product as one of THIS store's own products (name "… (copy)", no
   * stock, never on the website). Works for the store's own products and
   * for shared catalogue products; another store's products are refused.
   */
  async duplicate(storeId: number, id: number) {
    const p = await this.prisma.client.product.findUniqueOrThrow({
      where: { id },
      select: { storeId: true },
    });
    if (p.storeId !== null && p.storeId !== storeId)
      throw new ForbiddenException(
        'This product does not belong to this store',
      );
    const dup = await this.products.duplicate(id);
    if (p.storeId === null)
      await this.prisma.client.product.update({
        where: { id: dup.id },
        data: { storeId, status: 'ADMIN_ONLY' },
      });
    return { id: dup.id };
  }

  /**
   * This store's own price and/or name for a product/variant sold here.
   * Blank name / null price = the normal one; both blank removes the row.
   * Other stores and the website are never affected.
   */
  async setPrice(storeId: number, dto: StorePriceDto, adminId: number) {
    const c = this.prisma.client;
    const p = await c.product.findFirst({
      where: {
        id: dto.productId,
        deletedAt: null,
        OR: [{ storeId: null }, { storeId }],
      },
      include: { variants: { select: { id: true } } },
    });
    if (!p) throw new BadRequestException('Product is not sold at this store');
    const variantId = dto.variantId ?? null;
    if (p.hasVariants !== (variantId !== null))
      throw new BadRequestException(
        p.hasVariants ? 'Pick a variant' : 'This product has no variants',
      );
    if (variantId !== null && !p.variants.some((v) => v.id === variantId))
      throw new BadRequestException('Variant does not belong to this product');
    const where = { storeId, productId: p.id, variantId };
    const name = dto.name?.trim() || null;
    const price = dto.price ?? null;
    const salePrice = dto.salePrice ?? null;
    const weightKg = dto.weightKg ?? null;
    const weightUnit = weightKg === null ? null : (dto.weightUnit ?? null);

    if (salePrice !== null && price === null)
      throw new BadRequestException('Set a price before an offer price');
    if (name === null && price === null && weightKg === null) {
      // Keep a "removed from this store" row; clear only its name/price/weight.
      await c.storePrice.deleteMany({
        where: { ...where, hidden: false, mediaId: null },
      });
      await c.storePrice.updateMany({
        where,
        data: {
          price: null,
          salePrice: null,
          name: null,
          weightKg: null,
          weightUnit: null,
        },
      });
      return { reset: true };
    }
    if (salePrice !== null && price !== null && salePrice > price)
      throw new BadRequestException(
        'Offer price must not be higher than the price',
      );
    const data = {
      price,
      salePrice,
      name,
      weightKg,
      weightUnit,
      updatedById: adminId,
    };
    // ponytail: find-then-write; the unique expression index turns a rare
    // double-submit race into an error instead of a duplicate row.
    const existing = await c.storePrice.findFirst({ where });
    return existing
      ? c.storePrice.update({ where: { id: existing.id }, data })
      : c.storePrice.create({ data: { ...where, ...data } });
  }

  /**
   * The photo on the till. A store's own product: its real photo. A shared
   * product: this store's own photo only (the website keeps its gallery).
   * mediaId null = remove (shared: back to the website photo).
   */
  async setImage(
    storeId: number,
    productId: number,
    mediaId: number | null,
    adminId: number,
  ) {
    const c = this.prisma.client;
    const p = await c.product.findFirst({
      where: {
        id: productId,
        deletedAt: null,
        OR: [{ storeId: null }, { storeId }],
      },
      select: { storeId: true },
    });
    if (!p) throw new BadRequestException('Product is not sold at this store');
    if (
      mediaId !== null &&
      !(await c.media.findUnique({ where: { id: mediaId } }))
    )
      throw new BadRequestException('That image no longer exists');
    if (p.storeId !== null) {
      await c.$transaction([
        c.productMedia.deleteMany({ where: { productId } }),
        ...(mediaId
          ? [
              c.productMedia.create({
                data: { productId, mediaId, sortOrder: 0, isPrimary: true },
              }),
            ]
          : []),
      ]);
      return { mediaId, own: true };
    }
    const where = { storeId, productId, variantId: null };
    const existing = await c.storePrice.findFirst({ where });
    if (existing)
      await c.storePrice.update({
        where: { id: existing.id },
        data: { mediaId, updatedById: adminId },
      });
    else if (mediaId)
      await c.storePrice.create({
        data: { ...where, mediaId, updatedById: adminId },
      });
    return { mediaId, own: false };
  }

  /**
   * Change a product's (or size's) SKU from the till. A SKU is one code for
   * the website and every store, so a shared product's SKU needs the website
   * product permission; a store's own product only needs the POS one.
   * ponytail: the ad-catalog feed picks a shared product's new SKU up on its
   * 30-minute rebuild; invalidate it here if that lag ever matters.
   */
  async setSku(
    storeId: number,
    productId: number,
    variantId: number | null,
    sku: string,
    can: PermissionCheck,
  ) {
    const c = this.prisma.client;
    const p = await c.product.findFirst({
      where: {
        id: productId,
        deletedAt: null,
        OR: [{ storeId: null }, { storeId }],
      },
      select: {
        storeId: true,
        hasVariants: true,
        variants: { select: { id: true } },
      },
    });
    if (!p) throw new BadRequestException('Product is not sold at this store');
    if (p.storeId === null && !can('product.update'))
      throw new ForbiddenException(
        "This product's SKU is shared with the website — ask someone who can edit website products",
      );
    if (p.hasVariants !== (variantId !== null))
      throw new BadRequestException(
        p.hasVariants ? 'Pick a size' : 'This product has no sizes',
      );
    if (variantId !== null && !p.variants.some((v) => v.id === variantId))
      throw new BadRequestException(
        'That size does not belong to this product',
      );
    const value = sku.trim() || null;
    if (value && value.length > 64)
      throw new BadRequestException('SKU is too long (64 characters max)');
    try {
      if (variantId !== null)
        await c.productVariant.update({
          where: { id: variantId },
          data: { sku: value },
        });
      else
        await c.product.update({
          where: { id: productId },
          data: { sku: value },
        });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002')
        throw new BadRequestException(
          `SKU "${value}" is already used by another product`,
        );
      throw e;
    }
    return { sku: value };
  }

  /**
   * The shop's own cost for one of ITS products (shared products keep the
   * website's cost). Recorded in the cost history like a product-form edit:
   * the first cost covers earlier sales too, a change applies from today.
   */
  /**
   * Corrects the expiry date of this product's stock in this store (pencil
   * popup). Sets it on every delivery here (stock in, opening, transfer in);
   * the shelf / expiry report only read the deliveries still on the shelf.
   * ponytail: one date for the whole shelf; per-batch editing if shops ever
   * hold two batches with different dates.
   */
  async setExpiry(
    storeId: number,
    productId: number,
    variantId: number | null,
    expiryDate: string | null,
  ) {
    const { count } = await this.prisma.client.stockMovement.updateMany({
      where: {
        storeId,
        productId,
        variantId,
        type: { in: ['STOCK_IN', 'OPENING', 'TRANSFER_IN'] },
        qty: { gt: 0 },
      },
      data: {
        expiryDate: expiryDate ? new Date(`${expiryDate}T00:00:00Z`) : null,
      },
    });
    if (count === 0)
      throw new BadRequestException(
        'No stock has been received for this product in this store yet — set the expiry when you add stock',
      );
    return { expiryDate, deliveries: count };
  }

  async setCost(
    storeId: number,
    productId: number,
    variantId: number | null,
    cost: number,
    adminId: number,
  ) {
    const p = await this.prisma.client.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: {
        storeId: true,
        hasVariants: true,
        variants: { select: { id: true } },
      },
    });
    if (!p) throw new BadRequestException('Product not found');
    if (p.storeId !== storeId)
      throw new ForbiddenException(
        "Only this store's own products take a store cost — shared products use the website cost",
      );
    if (p.hasVariants !== (variantId !== null))
      throw new BadRequestException(
        p.hasVariants ? 'Pick a size' : 'This product has no sizes',
      );
    if (variantId !== null && !p.variants.some((v) => v.id === variantId))
      throw new BadRequestException(
        'That size does not belong to this product',
      );
    await this.costs.recordIfChanged({ productId, variantId, cost }, adminId);
    return { cost: cost.toFixed(2) };
  }

  /** Display unit lives beside the weight (ProductsService doesn't know it). */
  private async setUnit(id: number, dto: PosProductDto) {
    if (dto.weightUnit === undefined && dto.weightKg === undefined) return;
    await this.prisma.client.product.update({
      where: { id },
      data: {
        weightUnit: dto.weightKg == null ? null : (dto.weightUnit ?? null),
      },
    });
  }

  private fields(dto: PosProductDto) {
    return {
      translations: [{ locale: 'EN' as const, name: dto.name.trim() }],
      sku: dto.sku?.trim() || undefined,
      barcode: dto.barcode?.trim() || null,
      price: dto.price,
      // null (not undefined) so clearing the box on edit clears the value.
      salePrice: (dto.salePrice ?? null) as number,
      costPerItem: (dto.costPerItem ?? null) as number,
      categoryIds: dto.categoryId ? [dto.categoryId] : [],
      shippableWeight: (dto.weightKg ?? null) as number,
      mediaIds:
        dto.mediaId === undefined
          ? undefined
          : dto.mediaId
            ? [dto.mediaId]
            : [],
    };
  }
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'product'
  );
}
