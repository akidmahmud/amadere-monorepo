import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { PermissionCheck } from '../../common/auth/permission.decorator';
import { ProductsService } from '../products/products.service';
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
        translations: { select: { locale: true, name: true } },
        categories: { select: { categoryId: true } },
      },
    });
    return rows.map(({ translations, categories, ...p }) => ({
      ...p,
      name:
        translations.find((t) => t.locale === 'EN')?.name ??
        translations[0]?.name ??
        '',
      categoryId: categories[0]?.categoryId ?? null,
    }));
  }

  create(
    storeId: number,
    dto: PosProductDto,
    actor: { storeId: number | null; can: PermissionCheck },
  ) {
    // ponytail: random suffix keeps slugs unique without a lookup loop; the
    // slug is never public (store-only products are ADMIN_ONLY).
    const slug = `${slugify(dto.name)}-${randomBytes(3).toString('hex')}`;
    return this.products.create(
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
      throw new ForbiddenException('This product does not belong to this store');
    if (p.hasVariants)
      throw new ForbiddenException(
        'Products with variants are edited from the main Products page',
      );
    return this.products.update(id, this.fields(dto), actor);
  }

  /**
   * This store's own price for a product/variant sold here. price null =
   * back to the product's normal price. Other stores and the website are
   * never affected.
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

    if (dto.price == null) {
      await c.storePrice.deleteMany({ where });
      return { reset: true };
    }
    if (dto.salePrice != null && dto.salePrice > dto.price)
      throw new BadRequestException(
        'Offer price must not be higher than the price',
      );
    const data = {
      price: dto.price,
      salePrice: dto.salePrice ?? null,
      updatedById: adminId,
    };
    // ponytail: find-then-write; the unique expression index turns a rare
    // double-submit race into an error instead of a duplicate row.
    const existing = await c.storePrice.findFirst({ where });
    return existing
      ? c.storePrice.update({ where: { id: existing.id }, data })
      : c.storePrice.create({ data: { ...where, ...data } });
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
