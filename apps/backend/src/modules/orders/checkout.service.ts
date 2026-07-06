import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomBytes } from 'node:crypto';
import { Locale, OrderAddressType, Prisma } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PricingService } from '../cart/pricing.service';
import type { CartIdentity } from '../cart/cart.service';
import { PaymentsService } from '../payments/payments.service';
import { CheckoutDto } from './dto/checkout.dto';
import { CheckoutAddressDto } from './dto/checkout-address.dto';
import { RequestCodOtpDto } from './dto/request-cod-otp.dto';
import { ORDER_INCLUDE, OrderDto, toOrderDto } from './orders.mapper';
import { ORDER_CREATED_EVENT, OrderCreatedEvent } from './orders.events';

const Decimal = Prisma.Decimal;

function generateOrderNumber(): string {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `ORD-${ymd}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly payments: PaymentsService,
    private readonly events: EventEmitter2,
  ) {}

  async requestCodOtp(dto: RequestCodOtpDto): Promise<void> {
    const code = randomBytes(3)
      .readUIntBE(0, 3)
      .toString()
      .padStart(6, '0')
      .slice(-6);
    await this.prisma.client.otp.create({
      data: {
        identifier: dto.phone,
        purpose: 'COD_VERIFICATION',
        code,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });
    // Delivery is the same ConsoleOtpNotifier stub used by customer auth —
    // real SMS gateway plugs in there once credentials arrive.

    console.log(`[COD OTP] ${dto.phone}: ${code}`);
  }

  async checkout(
    identity: CartIdentity,
    dto: CheckoutDto,
    locale: Locale,
  ): Promise<OrderDto> {
    const cart = await this.findCart(identity, locale);
    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    const pricing = await this.pricing.price(
      cart.items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId,
        quantity: i.quantity,
      })),
      { couponCode: cart.couponCode, customerId: identity.customerId },
    );
    if (pricing.couponError) {
      throw new BadRequestException(pricing.couponError);
    }

    if (dto.paymentProvider === 'COD') {
      await this.verifyCodOtp(dto.shippingAddress.phone, dto.codOtpCode);
    }

    const voucher = dto.giftVoucherCode
      ? await this.validateVoucher(dto.giftVoucherCode)
      : null;
    const voucherAmount = voucher
      ? Decimal.min(voucher.remainingBalance, pricing.total)
      : new Decimal(0);
    const totalAmount = Decimal.max(
      pricing.total.minus(voucherAmount),
      new Decimal(0),
    );

    const order = await this.prisma.client.$transaction(async (tx) => {
      for (const item of cart.items) {
        await this.reserveStock(
          tx,
          item.productId,
          item.variantId,
          item.quantity,
        );
      }

      const orderNumber = generateOrderNumber();
      const created = await tx.order.create({
        data: {
          orderNumber,
          customerId: identity.customerId ?? null,
          subTotal: pricing.subTotal,
          discountAmount: pricing.totalDiscount,
          totalAmount,
          couponCode: cart.couponCode,
          customerNote: dto.customerNote,
          codVerifiedAt: dto.paymentProvider === 'COD' ? new Date() : undefined,
          items: {
            create: cart.items.map((item) => {
              const priced = pricing.lines.find(
                (l) =>
                  l.productId === item.productId &&
                  l.variantId === item.variantId,
              )!;
              return {
                productId: item.productId,
                variantId: item.variantId,
                productNameSnapshot:
                  item.product.translations[0]?.name ?? item.product.slug,
                skuSnapshot: item.variant?.sku ?? item.product.sku,
                unitPrice: priced.unitPrice,
                quantity: item.quantity,
              };
            }),
          },
          addresses: {
            create: [
              this.toAddressCreate(
                dto.shippingAddress,
                OrderAddressType.SHIPPING,
              ),
              this.toAddressCreate(
                dto.billingAddress ?? dto.shippingAddress,
                OrderAddressType.BILLING,
              ),
            ],
          },
          statusHistory: {
            create: { status: 'PENDING', note: 'Order placed' },
          },
        },
      });

      const couponApplied = pricing.discounts.find(
        (d) => d.source === 'COUPON',
      );
      if (couponApplied && cart.couponCode) {
        const discount = await tx.discount.findUnique({
          where: { code: cart.couponCode },
        });
        if (discount) {
          await tx.discountRedemption.create({
            data: {
              discountId: discount.id,
              customerId: identity.customerId,
              orderId: created.id,
            },
          });
          await tx.discount.update({
            where: { id: discount.id },
            data: { usedCount: { increment: 1 } },
          });
        }
      }

      if (voucher && voucherAmount.greaterThan(0)) {
        await tx.giftVoucherRedemption.create({
          data: {
            voucherId: voucher.id,
            orderId: created.id,
            amountUsed: voucherAmount,
          },
        });
        await tx.giftVoucher.update({
          where: { id: voucher.id },
          data: { remainingBalance: { decrement: voucherAmount } },
        });
      }

      const authResult = await this.payments
        .resolve(dto.paymentProvider)
        .authorize(created.id, totalAmount);
      await tx.payment.create({
        data: {
          orderId: created.id,
          provider: dto.paymentProvider,
          status: authResult.status,
          amount: totalAmount,
          transactionRef: authResult.transactionRef,
          rawResponse: (authResult.rawResponse as object) ?? undefined,
        },
      });

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      await tx.cart.update({
        where: { id: cart.id },
        data: { couponCode: null },
      });

      return created;
    });

    this.events.emit(ORDER_CREATED_EVENT, {
      orderId: order.id,
      customerId: identity.customerId ?? null,
    } satisfies OrderCreatedEvent);

    return this.getByIdInternal(order.id);
  }

  private async getByIdInternal(id: number) {
    const order = await this.prisma.client.order.findUniqueOrThrow({
      where: { id },
      include: ORDER_INCLUDE,
    });
    return toOrderDto(order);
  }

  private toAddressCreate(address: CheckoutAddressDto, type: OrderAddressType) {
    return {
      type,
      recipientName: address.recipientName,
      phone: address.phone,
      email: address.email,
      division: address.division,
      district: address.district,
      area: address.area,
      landmark: address.landmark,
      addressLine: address.addressLine,
      postCode: address.postCode,
    };
  }

  private async verifyCodOtp(
    phone: string,
    code: string | undefined,
  ): Promise<void> {
    if (!code)
      throw new BadRequestException(
        'codOtpCode is required for Cash on Delivery',
      );
    const otp = await this.prisma.client.otp.findFirst({
      where: {
        identifier: phone,
        purpose: 'COD_VERIFICATION',
        code,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw new BadRequestException('Invalid or expired OTP');
    await this.prisma.client.otp.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });
  }

  private async validateVoucher(code: string) {
    const voucher = await this.prisma.client.giftVoucher.findUnique({
      where: { code },
    });
    if (!voucher) throw new NotFoundException('Gift voucher not found');
    if (voucher.status !== 'ACTIVE')
      throw new BadRequestException('Gift voucher is not active');
    if (voucher.expiresAt && voucher.expiresAt < new Date())
      throw new BadRequestException('Gift voucher has expired');
    if (voucher.remainingBalance.lessThanOrEqualTo(0))
      throw new BadRequestException('Gift voucher has no remaining balance');
    return voucher;
  }

  // Atomic hold: only succeeds if enough stock is actually available, so
  // concurrent checkouts can never oversell (AGENTS.md §6 — a gap the old
  // app never closed, see B1 review notes).
  private async reserveStock(
    tx: Prisma.TransactionClient,
    productId: number,
    variantId: number | null,
    quantity: number,
  ): Promise<void> {
    if (quantity <= 0) return;

    if (variantId) {
      const affected = await tx.$executeRaw`
        UPDATE product_variants SET reserved_stock = reserved_stock + ${quantity}
        WHERE id = ${variantId} AND stock - reserved_stock >= ${quantity}
      `;
      if (affected === 0)
        throw new ConflictException(
          `Insufficient stock for variant #${variantId}`,
        );
      return;
    }

    const product = await tx.product.findUniqueOrThrow({
      where: { id: productId },
    });
    if (!product.trackInventory) return;

    const affected = await tx.$executeRaw`
      UPDATE products SET reserved_stock = reserved_stock + ${quantity}
      WHERE id = ${productId} AND (allow_backorder OR stock - reserved_stock >= ${quantity})
    `;
    if (affected === 0)
      throw new ConflictException(`Insufficient stock for "${product.slug}"`);
  }

  private async findCart(identity: CartIdentity, locale: Locale) {
    const where = identity.customerId
      ? { customerId: identity.customerId }
      : identity.guestToken
        ? { guestToken: identity.guestToken }
        : null;
    if (!where) return null;

    return this.prisma.client.cart.findFirst({
      where,
      include: {
        items: {
          include: {
            product: {
              include: { translations: { where: { locale }, take: 1 } },
            },
            variant: true,
          },
        },
      },
    });
  }
}
