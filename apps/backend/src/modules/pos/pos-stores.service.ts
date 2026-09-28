import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StoresService } from '../stores/stores.service';
import { ProductsService } from '../products/products.service';

/**
 * Duplicate a store: a new outlet set up like an existing one. Copies the
 * settings and till accounts, the receipt template, this store's own names
 * and prices for shared products, and its store-only products (with no
 * stock — stock is never copied). Staff, sales and stock stay with the
 * original. Lives in the POS module because it needs ProductsService, which
 * StoresModule cannot import (ProductsModule already imports it).
 */
@Injectable()
export class PosStoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stores: StoresService,
    private readonly products: ProductsService,
  ) {}

  async duplicate(id: number, name: string, code: string) {
    const c = this.prisma.client;
    const src = await c.store.findUniqueOrThrow({ where: { id } });
    if (await c.store.findUnique({ where: { code } }))
      throw new BadRequestException(`Store code "${code}" is already used`);

    const copy = await this.stores.create({
      name,
      code,
      address: src.address ?? undefined,
      phone: src.phone ?? undefined,
      isActive: src.isActive,
      cashAccountId: src.cashAccountId,
      cardAccountId: src.cardAccountId,
      mobileAccountId: src.mobileAccountId,
    });

    const tpl = await c.posInvoiceTemplate.findFirst({ where: { storeId: id } });
    if (tpl)
      await c.posInvoiceTemplate.create({
        data: { storeId: copy.id, html: tpl.html, updatedById: tpl.updatedById },
      });

    // Own names/prices for SHARED products only; store-only products are
    // re-created below with their own prices.
    const overrides = await c.storePrice.findMany({
      where: { storeId: id, product: { storeId: null } },
    });
    if (overrides.length)
      await c.storePrice.createMany({
        data: overrides.map((o) => ({
          storeId: copy.id,
          productId: o.productId,
          variantId: o.variantId,
          price: o.price,
          salePrice: o.salePrice,
          name: o.name,
          updatedById: o.updatedById,
        })),
      });

    const own = await c.product.findMany({
      where: { storeId: id, deletedAt: null },
      include: { translations: { select: { locale: true, name: true } } },
    });
    // ponytail: one duplicate() per product, sequential — fine for a store's
    // handful of own products; batch it if stores carry hundreds.
    for (const p of own) {
      const dup = await this.products.duplicate(p.id);
      await c.product.update({
        where: { id: dup.id },
        data: { storeId: copy.id },
      });
      // duplicate() appends " (copy)"; in the new store the name is the same.
      for (const t of p.translations)
        await c.productTranslation.updateMany({
          where: { productId: dup.id, locale: t.locale },
          data: { name: t.name },
        });
    }

    return { ...copy, copied: { products: own.length, overrides: overrides.length, invoiceTemplate: !!tpl } };
  }
}
