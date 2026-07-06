import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'node:crypto';
import { Cart, Locale } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PricingService } from './pricing.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { BuyNowDto } from './dto/buy-now.dto';
import { CART_UPDATED_EVENT, CartUpdatedEvent } from './cart.events';
import { CartViewDto, PricingSummaryDto } from './dto/cart-response.dto';

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
  ) {}

  async getView(identity: CartIdentity, locale: Locale): Promise<CartViewDto> {
    const cart = await this.findCart(identity);
    if (!cart) return this.emptyView(identity);
    return this.buildView(cart.id, locale, identity.customerId);
  }

  async addItem(
    identity: CartIdentity,
    dto: AddCartItemDto,
    locale: Locale,
  ): Promise<CartViewDto> {
    const { productId, variantId, quantity } = await this.validateLine(dto);
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
          quantity: existing.quantity + (quantity ?? 1),
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
    });
    if (!item) throw new NotFoundException('Cart item not found');

    await this.prisma.client.cartItem.update({
      where: { id: itemId },
      data: { quantity },
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
          data: { quantity: existing.quantity + item.quantity },
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
    const { productId, variantId, quantity } = await this.validateLine(dto);
    const pricing = await this.pricing.price(
      [{ productId, variantId, quantity: quantity ?? 1 }],
      { customerId },
    );
    return this.serializePricing(pricing);
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
      if (!dto.variantId)
        throw new BadRequestException('This product requires a variantId');
      const variant = product.variants.find((v) => v.id === dto.variantId);
      if (!variant)
        throw new BadRequestException(
          'Variant does not belong to this product',
        );
      variantId = variant.id;
    } else if (dto.variantId) {
      throw new BadRequestException('This product does not have variants');
    }

    const quantity = dto.quantity ?? 1;
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

    return { productId: product.id, variantId, quantity };
  }

  private async currentUnitPrice(productId: number, variantId: number | null) {
    const pricing = await this.pricing.price(
      [{ productId, variantId, quantity: 1 }],
      {},
    );
    return pricing.lines[0].unitPrice;
  }

  private async buildView(cartId: number, locale: Locale, customerId?: number) {
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
      ...this.serializePricing(pricing),
      crossSell: await this.crossSell(
        cart.items.map((i) => i.productId),
        locale,
      ),
    };
  }

  private serializePricing(
    pricing: Awaited<ReturnType<PricingService['price']>>,
  ) {
    return {
      subTotal: pricing.subTotal.toString(),
      discounts: pricing.discounts.map((d) => ({
        source: d.source,
        label: d.label,
        amount: d.amount.toString(),
        freeShipping: d.freeShipping ?? false,
      })),
      totalDiscount: pricing.totalDiscount.toString(),
      total: pricing.total.toString(),
      couponError: pricing.couponError,
      freeShipping: pricing.freeShipping,
    };
  }

  private async crossSell(productIds: number[], locale: Locale) {
    if (productIds.length === 0) return [];
    const relations = await this.prisma.client.productRelation.findMany({
      where: {
        fromProductId: { in: productIds },
        type: 'CROSS_SELL',
        toProduct: { deletedAt: null, status: 'PUBLISHED' },
      },
      include: {
        toProduct: {
          include: {
            translations: true,
            media: {
              where: { isPrimary: true },
              include: { media: true },
              take: 1,
            },
          },
        },
      },
      take: 8,
    });

    const seen = new Set<number>();
    return relations
      .filter((r) => !productIds.includes(r.toProductId))
      .filter((r) =>
        seen.has(r.toProductId) ? false : (seen.add(r.toProductId), true),
      )
      .map((r) => {
        const translation =
          r.toProduct.translations.find((t) => t.locale === locale) ??
          r.toProduct.translations[0];
        return {
          id: r.toProduct.id,
          slug: r.toProduct.slug,
          name: translation?.name ?? r.toProduct.slug,
          price: r.toProduct.price?.toString() ?? null,
          imageUrl: r.toProduct.media[0]?.media.url ?? null,
        };
      });
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
      freeShipping: null,
      crossSell: [],
    };
  }

  private emitUpdated(cart: Cart): void {
    this.events.emit(CART_UPDATED_EVENT, {
      cartId: cart.id,
      customerId: cart.customerId,
    } satisfies CartUpdatedEvent);
  }
}
