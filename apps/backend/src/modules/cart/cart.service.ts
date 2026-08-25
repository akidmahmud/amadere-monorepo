import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'node:crypto';
import { Cart, Locale, PaymentProvider, Prisma } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { computeCheckoutFees } from '../net-profit/accounts/accounts.constants';
import { ShippingZonesService } from '../shipping-zones/shipping-zones.service';
import { PricingService } from './pricing.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { BuyNowDto } from './dto/buy-now.dto';
import { CART_UPDATED_EVENT, CartUpdatedEvent } from './cart.events';
import { CartViewDto, PricingSummaryDto } from './dto/cart-response.dto';
import { PRODUCT_INCLUDE } from '../products/product-includes';
import { toPublicProductDto } from '../products/products.mapper';
import { isDigitalOnly } from '../orders/digital-order.util';

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export interface CartIdentity {
  customerId?: number;
  guestToken?: string;
}

const CART_ITEMS_INCLUDE = {
  items: {
    include: {
      product: {
        include: {
          translations: true,
          media: {
            where: { isPrimary: true },
            include: { media: true },
            take: 1,
          },
        },
      },
      variant: {
        include: {
          attributeValues: {
            include: { attributeValue: { include: { translations: true } } },
          },
        },
      },
    },
    orderBy: { id: 'asc' as const },
  },
} as const;

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly events: EventEmitter2,
    private readonly shippingZones: ShippingZonesService,
  ) {}

  async getView(
    identity: CartIdentity,
    locale: Locale,
    paymentProvider?: PaymentProvider,
    district?: string,
  ): Promise<CartViewDto> {
    const cart = await this.findCart(identity);
    if (!cart) return this.emptyView(identity);
    return this.buildView(cart.id, locale, identity.customerId, paymentProvider, district);
  }

  async addItem(
    identity: CartIdentity,
    dto: AddCartItemDto,
    locale: Locale,
  ): Promise<CartViewDto> {
    const { productId, variantId, quantity, productType } = await this.validateLine(dto);
    const cart =
      (await this.findCart(identity)) ?? (await this.createCart(identity));

    const existing = await this.prisma.client.cartItem.findFirst({
      where: { cartId: cart.id, productId, variantId },
    });

    const unitPrice = await this.currentUnitPrice(productId, variantId);
    if (existing) {
      await this.prisma.client.cartItem.update({
        where: { id: existing.id },
        data: {
          // Digital lines never accumulate — re-adding the same ebook leaves
          // the quantity at 1 instead of stacking a second copy.
          quantity:
            productType === 'DIGITAL' ? 1 : existing.quantity + (quantity ?? 1),
          unitPriceSnapshot: unitPrice,
        },
      });
    } else {
      await this.prisma.client.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          variantId,
          quantity: quantity ?? 1,
          unitPriceSnapshot: unitPrice,
        },
      });
    }

    this.emitUpdated(cart);
    return this.buildView(cart.id, locale, identity.customerId);
  }

  async updateItem(
    identity: CartIdentity,
    itemId: number,
    quantity: number,
    locale: Locale,
  ): Promise<CartViewDto> {
    const cart = await this.requireCart(identity);
    const item = await this.prisma.client.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
      include: { product: { select: { productType: true } } },
    });
    if (!item) throw new NotFoundException('Cart item not found');

    await this.prisma.client.cartItem.update({
      where: { id: itemId },
      // This path never goes through validateLine, so the digital pin is
      // re-applied here: the stepper must not be able to raise an ebook
      // above one copy.
      data: {
        quantity: item.product.productType === 'DIGITAL' ? 1 : quantity,
      },
    });
    this.emitUpdated(cart);
    return this.buildView(cart.id, locale, identity.customerId);
  }

  async removeItem(
    identity: CartIdentity,
    itemId: number,
    locale: Locale,
  ): Promise<CartViewDto> {
    const cart = await this.requireCart(identity);
    const item = await this.prisma.client.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
    });
    if (!item) throw new NotFoundException('Cart item not found');

    await this.prisma.client.cartItem.delete({ where: { id: itemId } });
    this.emitUpdated(cart);
    return this.buildView(cart.id, locale, identity.customerId);
  }

  async applyCoupon(
    identity: CartIdentity,
    code: string,
    locale: Locale,
  ): Promise<CartViewDto> {
    const cart = await this.requireCart(identity);
    await this.prisma.client.cart.update({
      where: { id: cart.id },
      data: { couponCode: code },
    });

    const view = await this.buildView(cart.id, locale, identity.customerId);
    if (view.couponError) {
      // Invalid coupon must not stick — restore whatever was applied before.
      await this.prisma.client.cart.update({
        where: { id: cart.id },
        data: { couponCode: cart.couponCode },
      });
      throw new BadRequestException(view.couponError);
    }
    return view;
  }

  async removeCoupon(
    identity: CartIdentity,
    locale: Locale,
  ): Promise<CartViewDto> {
    const cart = await this.requireCart(identity);
    await this.prisma.client.cart.update({
      where: { id: cart.id },
      data: { couponCode: null },
    });
    return this.buildView(cart.id, locale, identity.customerId);
  }

  // Called after login: fold the guest cart into the customer's cart.
  async merge(
    customerId: number,
    guestToken: string,
    locale: Locale,
  ): Promise<CartViewDto> {
    const guestCart = await this.prisma.client.cart.findUnique({
      where: { guestToken },
      include: { items: true },
    });
    if (!guestCart) throw new NotFoundException('Guest cart not found');

    let customerCart = await this.prisma.client.cart.findFirst({
      where: { customerId },
    });
    if (!customerCart) {
      // Simplest merge: the guest cart just becomes the customer's cart.
      customerCart = await this.prisma.client.cart.update({
        where: { id: guestCart.id },
        data: { customerId, guestToken: null },
      });
      return this.buildView(customerCart.id, locale, customerId);
    }

    // productType is needed to keep a digital line pinned at 1 through the
    // merge — the same ebook sitting in both the guest and the customer cart
    // would otherwise sum to 2.
    const mergedTypes = new Map(
      (
        await this.prisma.client.product.findMany({
          where: { id: { in: guestCart.items.map((i) => i.productId) } },
          select: { id: true, productType: true },
        })
      ).map((p) => [p.id, p.productType]),
    );

    for (const item of guestCart.items) {
      const existing = await this.prisma.client.cartItem.findFirst({
        where: {
          cartId: customerCart.id,
          productId: item.productId,
          variantId: item.variantId,
        },
      });
      if (existing) {
        await this.prisma.client.cartItem.update({
          where: { id: existing.id },
          data: {
            quantity:
              mergedTypes.get(item.productId) === 'DIGITAL'
                ? 1
                : existing.quantity + item.quantity,
          },
        });
      } else {
        await this.prisma.client.cartItem.create({
          data: {
            cartId: customerCart.id,
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            unitPriceSnapshot: item.unitPriceSnapshot,
          },
        });
      }
    }
    await this.prisma.client.cart.delete({ where: { id: guestCart.id } });

    this.emitUpdated(customerCart);
    return this.buildView(customerCart.id, locale, customerId);
  }

  // "Buy Now" express path: a priced quote for a single line, no cart touched.
  async buyNowQuote(
    dto: BuyNowDto,
    locale: Locale,
    customerId?: number,
  ): Promise<PricingSummaryDto> {
    const { productId, variantId, quantity, productType } = await this.validateLine(dto);
    const pricing = await this.pricing.price(
      [{ productId, variantId, quantity: quantity ?? 1 }],
      { customerId },
    );
    return this.serializePricing(pricing, undefined, [{ productType }]);
  }

  // ------------------------------------------------------------------

  private async findCart(identity: CartIdentity): Promise<Cart | null> {
    if (identity.customerId) {
      return this.prisma.client.cart.findFirst({
        where: { customerId: identity.customerId },
      });
    }
    if (identity.guestToken) {
      return this.prisma.client.cart.findUnique({
        where: { guestToken: identity.guestToken },
      });
    }
    return null;
  }

  private async requireCart(identity: CartIdentity): Promise<Cart> {
    const cart = await this.findCart(identity);
    if (!cart) throw new NotFoundException('Cart not found');
    return cart;
  }

  private async createCart(identity: CartIdentity): Promise<Cart> {
    return this.prisma.client.cart.create({
      data: identity.customerId
        ? { customerId: identity.customerId }
        : { guestToken: randomUUID() },
    });
  }

  private async validateLine(dto: AddCartItemDto) {
    const product = await this.prisma.client.product.findFirst({
      where: { id: dto.productId, deletedAt: null, status: 'PUBLISHED' },
      include: { variants: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    let variantId: number | null = null;
    if (product.hasVariants) {
      const match = dto.variantId
        ? product.variants.find((v) => v.id === dto.variantId)
        : undefined;
      const variant =
        match ??
        product.variants.find((v) => v.isDefault) ??
        product.variants[0];

      if (!variant) {
        throw new BadRequestException('No active variants available for this product');
      }
      variantId = variant.id;
    } else {
      variantId = null;
    }

    // A digital product is a licence to download one file — a second copy of
    // the same PDF is meaningless, so the quantity is pinned to 1 whatever the
    // client asks for. min/maxOrderQuantity are physical-stock concepts and
    // are skipped: an admin who left minOrderQuantity at 2 on a book must not
    // make it unbuyable.
    const isDigital = product.productType === 'DIGITAL';
    const quantity = isDigital ? 1 : (dto.quantity ?? 1);
    if (!isDigital) {
      if (quantity < product.minOrderQuantity) {
        throw new BadRequestException(
          `Minimum order quantity is ${product.minOrderQuantity}`,
        );
      }
      if (product.maxOrderQuantity && quantity > product.maxOrderQuantity) {
        throw new BadRequestException(
          `Maximum order quantity is ${product.maxOrderQuantity}`,
        );
      }
    }

    // Advisory only — the atomic hold at checkout (CheckoutService.reserveStock)
    // is the real guard against overselling; this just gives an earlier,
    // friendlier error using the same stock-minus-reserved math.
    if (product.trackInventory && !product.allowBackorder) {
      const variantRow = variantId
        ? product.variants.find((v) => v.id === variantId)
        : undefined;
      const available = variantId
        ? variantRow
          ? variantRow.stock - variantRow.reservedStock
          : 0
        : product.stock - product.reservedStock;
      if (available < quantity)
        throw new BadRequestException('Insufficient stock');
    }

    return { productId: product.id, variantId, quantity, productType: product.productType };
  }

  private async currentUnitPrice(productId: number, variantId: number | null) {
    const pricing = await this.pricing.price(
      [{ productId, variantId, quantity: 1 }],
      {},
    );
    return pricing.lines[0].unitPrice;
  }

  private async buildView(
    cartId: number,
    locale: Locale,
    customerId?: number,
    paymentProvider?: PaymentProvider,
    district?: string,
  ) {
    const cart = await this.prisma.client.cart.findUniqueOrThrow({
      where: { id: cartId },
      include: CART_ITEMS_INCLUDE,
    });

    const pricing = await this.pricing.price(
      cart.items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId,
        quantity: i.quantity,
      })),
      { couponCode: cart.couponCode, customerId },
    );

    const priceByKey = new Map(
      pricing.lines.map((l) => [`${l.productId}:${l.variantId ?? ''}`, l]),
    );

    const recommendations = await this.getRecommendations(
      cart.items.map((i) => i.productId),
      locale,
    );

    return {
      id: cart.id,
      guestToken: cart.guestToken,
      currency: cart.currency,
      couponCode: cart.couponCode,
      items: cart.items.map((item) => {
        const translation =
          item.product.translations.find((t) => t.locale === locale) ??
          item.product.translations[0];
        const priced = priceByKey.get(
          `${item.productId}:${item.variantId ?? ''}`,
        );
        return {
          id: item.id,
          productId: item.productId,
          variantId: item.variantId,
          productType: item.product.productType,
          slug: item.product.slug,
          name: translation?.name ?? item.product.slug,
          imageUrl: item.product.media[0]?.media.url ?? null,
          variantLabel: item.variant
            ? item.variant.attributeValues
                .map((av) => {
                  const t =
                    av.attributeValue.translations.find(
                      (x) => x.locale === locale,
                    ) ?? av.attributeValue.translations[0];
                  return t?.value ?? '';
                })
                .join(' / ')
            : null,
          quantity: item.quantity,
          unitPrice: priced?.unitPrice.toString() ?? '0',
          lineTotal: priced?.lineTotal.toString() ?? '0',
        };
      }),
      ...(await this.serializePricing(
        pricing,
        district,
        cart.items.map((i) => ({ productType: i.product.productType })),
      )),
      crossSell: recommendations.crossSell.map((p) => {
        // Variant-only products carry no price on the product itself (see
        // PublicProductDto.price's own comment) — same default-variant
        // fallback toProductCardData uses on the frontend, so cross-sell
        // cards don't silently hide the price for every variant product.
        const defaultVariant = p.variants.find((v) => v.isDefault) ?? p.variants[0];
        return {
          id: p.id,
          slug: p.slug,
          name: p.name,
          price: p.price ?? defaultVariant?.price ?? null,
          imageUrl: p.media[0]?.url ?? null,
        };
      }),
      crossSellProducts: recommendations.crossSell,
      frequentlyBoughtTogether: recommendations.frequentlyBoughtTogether,
    };
  }

  private async serializePricing(
    pricing: Awaited<ReturnType<PricingService['price']>>,
    district: string | undefined,
    lines: { productType: string }[],
  ) {
    const zones = await this.shippingZones.getConfig();
    // Neither tax nor the COD fee are charged on an order — both are
    // internal accounting-only figures, see computeCheckoutFees's own
    // comment (accounts.service.ts).
    //
    // A digital-only cart has nothing to ship, so the preview matches what
    // checkout.service.ts will actually charge — computeCheckoutFees already
    // early-returns 0 for freeShipping, so no change to the shared function.
    const { shippingFee } = computeCheckoutFees(
      pricing.discounts.some((d) => d.freeShipping) || isDigitalOnly(lines),
      district,
      zones,
    );
    return {
      subTotal: pricing.subTotal.toString(),
      // Only entries that actually do something are shown. A coupon or
      // promotion that lost the "bigger wins" comparison to an upsell stage
      // stays in `pricing.discounts` zeroed (PricingService.applyUpsellBar
      // keeps it so its freeShipping flag survives, see above), but a
      // "-৳0" line in the customer's order summary is just noise.
      discounts: pricing.discounts
        .filter((d) => d.amount.greaterThan(0) || d.freeShipping === true)
        .map((d) => ({
          source: d.source,
          label: d.label,
          amount: d.amount.toString(),
          freeShipping: d.freeShipping ?? false,
        })),
      totalDiscount: pricing.totalDiscount.toString(),
      total: pricing.total.toString(),
      couponError: pricing.couponError,
      upsell: pricing.upsell,
      taxAmount: '0',
      codFee: '0',
      shippingFee: shippingFee.toString(),
      grandTotal: pricing.total.plus(shippingFee).toString(),
    };
  }

  private async getRecommendations(productIds: number[], locale: Locale) {
    if (productIds.length === 0) {
      return { frequentlyBoughtTogether: [], crossSell: [] };
    }

    const isInStock = (p: any) => {
      if (!p.trackInventory || p.allowBackorder) return true;
      if (p.hasVariants && p.variants && p.variants.length > 0) {
        return p.variants.some((v: any) => v.stock > 0);
      }
      return p.stock > 0;
    };

    // 1. Frequently Bought Together
    const fbtRelations = await this.prisma.client.productRelation.findMany({
      where: {
        fromProductId: { in: productIds },
        type: 'FREQUENTLY_BOUGHT_TOGETHER',
        toProduct: { deletedAt: null, status: 'PUBLISHED', id: { notIn: productIds } },
      },
      include: {
        toProduct: {
          include: PRODUCT_INCLUDE,
        },
      },
    });

    // "Frequently bought together" must mean exactly that. This used to pad the
    // list with random published products whenever fewer than 4 real relations
    // existed, so the section showed items nobody had paired with anything —
    // presented under a heading claiming other customers bought them together.
    // Now it shows the configured relations and nothing else, which means the
    // section can be empty, and that is correct.
    //
    // When several cart items each have their own set, ONE cart item is picked
    // at random and its set is shown whole, rather than merging every set into
    // one row. A merged row is incoherent: the heading promises a bundle, and a
    // union of unrelated pairings is not one.
    const relationsBySource = new Map<number, typeof fbtRelations>();
    for (const relation of fbtRelations) {
      const bucket = relationsBySource.get(relation.fromProductId) ?? [];
      bucket.push(relation);
      relationsBySource.set(relation.fromProductId, bucket);
    }

    const sourcesWithRelations = [...relationsBySource.keys()];
    const chosenSource =
      sourcesWithRelations.length > 0
        ? shuffleArray(sourcesWithRelations)[0]
        : undefined;

    const seenFbtIds = new Set<number>();
    let fbtRaw =
      chosenSource === undefined
        ? []
        : (relationsBySource.get(chosenSource) ?? [])
            .map((r) => r.toProduct)
            .filter((p) =>
              isInStock(p) && !seenFbtIds.has(p.id)
                ? (seenFbtIds.add(p.id), true)
                : false,
            );

    fbtRaw = shuffleArray(fbtRaw);

    const fbtProductIds = Array.from(seenFbtIds);

    // 2. Cross Sell
    const excludeForCrossSell = [...productIds, ...fbtProductIds];
    const crossSellRelations = await this.prisma.client.productRelation.findMany({
      where: {
        fromProductId: { in: productIds },
        type: 'CROSS_SELL',
        toProduct: { deletedAt: null, status: 'PUBLISHED', id: { notIn: excludeForCrossSell } },
      },
      include: {
        toProduct: {
          include: PRODUCT_INCLUDE,
        },
      },
    });

    const seenCsIds = new Set<number>();
    let crossSellRaw = crossSellRelations
      .map((r) => r.toProduct)
      .filter((p) => (isInStock(p) && !seenCsIds.has(p.id) ? (seenCsIds.add(p.id), true) : false));

    // Randomize order
    crossSellRaw = shuffleArray(crossSellRaw);

    // Fallback to random published products if fewer than 4 relations exist
    if (crossSellRaw.length < 4) {
      const excludeAll = [...excludeForCrossSell, ...Array.from(seenCsIds)];
      const fallbackProducts = await this.prisma.client.product.findMany({
        where: {
          deletedAt: null,
          status: 'PUBLISHED',
          id: { notIn: excludeAll },
        },
        include: PRODUCT_INCLUDE,
        take: 20,
      });

      const shuffledFallback = shuffleArray(fallbackProducts);
      for (const p of shuffledFallback) {
        if (crossSellRaw.length >= 4) break;
        if (isInStock(p) && !seenCsIds.has(p.id)) {
          seenCsIds.add(p.id);
          crossSellRaw.push(p);
        }
      }
    }

    return {
      frequentlyBoughtTogether: fbtRaw.map((p) => toPublicProductDto(p, locale)),
      crossSell: crossSellRaw.map((p) => toPublicProductDto(p, locale)),
    };
  }

  private emptyView(identity: CartIdentity) {
    return {
      id: null,
      guestToken: identity.guestToken ?? null,
      currency: 'BDT',
      couponCode: null,
      items: [],
      subTotal: '0',
      discounts: [],
      totalDiscount: '0',
      total: '0',
      couponError: null,
      upsell: null,
      taxAmount: '0',
      codFee: '0',
      shippingFee: '0',
      grandTotal: '0',
      crossSell: [],
      crossSellProducts: [],
      frequentlyBoughtTogether: [],
    };
  }

  private emitUpdated(cart: Cart): void {
    this.events.emit(CART_UPDATED_EVENT, {
      cartId: cart.id,
      customerId: cart.customerId,
    } satisfies CartUpdatedEvent);
  }
}
