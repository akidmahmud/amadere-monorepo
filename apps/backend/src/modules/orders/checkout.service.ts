import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomInt } from 'node:crypto';
import { Locale, OrderAddressType, Prisma } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PricingService } from '../cart/pricing.service';
import type { CartIdentity } from '../cart/cart.service';
import { PaymentsService } from '../payments/payments.service';
import { FraudService } from '../net-profit/fraud/fraud.service';
import { BlockerService } from '../net-profit/blocker/blocker.service';
import { AdvancePaymentService } from '../net-profit/advance-payment/advance-payment.service';
import { OtpSecurityService } from '../net-profit/otp-security/otp-security.service';
import { SmsService } from '../net-profit/sms/sms.service';
import { CheckoutDto } from './dto/checkout.dto';
import { CheckoutAddressDto } from './dto/checkout-address.dto';
import { RequestCodOtpDto } from './dto/request-cod-otp.dto';
import { ORDER_INCLUDE, OrderDto, toOrderDto } from './orders.mapper';
import { ORDER_CREATED_EVENT, OrderCreatedEvent } from './orders.events';
import { generateOrderNumber } from './order-number.util';
import { reserveStock } from './stock-reservation.util';
import { toOrderAddressCreate } from './order-address.util';

const Decimal = Prisma.Decimal;

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly payments: PaymentsService,
    private readonly events: EventEmitter2,
    private readonly fraud: FraudService,
    private readonly blocker: BlockerService,
    private readonly advancePayment: AdvancePaymentService,
    private readonly otpSecurity: OtpSecurityService,
    private readonly sms: SmsService,
  ) {}

  async requestCodOtp(dto: RequestCodOtpDto, ip?: string): Promise<void> {
    const otpSettings = await this.otpSecurity.getSettings();
    if (!otpSettings.codOtpEnabled) {
      throw new BadRequestException('COD OTP verification is currently disabled');
    }

    // ADDENDUM §I — evaluates the caller's IP for VPN/proxy; throws a
    // ForbiddenException itself when policy=block, so a blocked request
    // never even gets a real OTP row created.
    const vpnResult = await this.otpSecurity.evaluate(ip);

    const recentCount = await this.prisma.client.otp.count({
      where: { identifier: dto.phone, purpose: 'COD_VERIFICATION', createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
    });
    if (recentCount >= 5) {
      throw new BadRequestException('Too many OTP requests — please try again later');
    }

    const length = Math.min(8, Math.max(4, otpSettings.codOtpLength));
    const code = randomInt(10 ** (length - 1), 10 ** length).toString();
    await this.prisma.client.otp.create({
      data: {
        identifier: dto.phone,
        purpose: 'COD_VERIFICATION',
        code,
        ipAddress: ip,
        isVpn: vpnResult.isVpn,
        expiresAt: new Date(Date.now() + otpSettings.codOtpExpiryMinutes * 60 * 1000),
      },
    });
    await this.sms.sendTemplate('otp', dto.phone, 'EN', { code });
  }

  async checkout(
    identity: CartIdentity,
    dto: CheckoutDto,
    locale: Locale,
    ip?: string,
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

    // Net Profit Blocker Manager (§7.6, ADDENDUM 12-rule auto engine) —
    // applies to every payment method, not just COD. Runs after pricing
    // since several rules (minimum order amount, new-customer high value,
    // duplicate order) need the real cart total/product set.
    const blockResult = await this.blocker.evaluateCheckout({
      phone: dto.shippingAddress.phone,
      email: dto.shippingAddress.email ?? '',
      ip: ip ?? '',
      deviceId: dto.deviceId ?? '',
      name: dto.shippingAddress.recipientName,
      address: this.compactAddress(dto.shippingAddress),
      orderTotal: pricing.total.toNumber(),
      productIds: cart.items.map((i) => i.productId),
      checkoutStartedAt: dto.checkoutStartedAt,
    });
    if (blockResult.blocked) {
      throw new ForbiddenException({
        message: blockResult.reason ?? 'This order could not be placed. Please contact support.',
        details: {
          blocked: true,
          heading: blockResult.heading,
          sub: blockResult.sub,
          reason: blockResult.reason,
          contacts: blockResult.contacts,
        },
      });
    }

    // Set below when the fraud gate's action is "advance" (M4) — applied to
    // the real order only after it's actually created.
    let requireAdvancePercent: number | undefined;
    let codOtpVerified = false;

    if (dto.paymentProvider === 'COD') {
      const otpSettings = await this.otpSecurity.getSettings();
      if (otpSettings.codOtpEnabled) {
        await this.verifyCodOtp(dto.shippingAddress.phone, dto.codOtpCode);
        codOtpVerified = true;
      }

      // Net Profit courier fraud gate (CLAUDE.net-profit.md §7.2) — only
      // applies to COD, since a prepaid order carries no delivery-refusal
      // risk. No-ops entirely when the feature is disabled/set to "off".
      const gate = await this.fraud.evaluateCheckoutGate(dto.shippingAddress.phone);
      if (!gate.allowed) {
        const savingAmount = await this.fraud.savingAmountFor(pricing.total);
        await this.fraud.recordSaving(
          dto.shippingAddress.phone,
          savingAmount,
          'auto_block',
        );
        await this.blocker.maybeAutoBlockFraud(dto.shippingAddress.phone);
        throw new ForbiddenException(
          gate.blockMessage
            ? `${gate.blockMessage.en} / ${gate.blockMessage.bn}`
            : 'This order could not be placed.',
        );
      }
      if (gate.requireAdvancePercent) {
        requireAdvancePercent = gate.requireAdvancePercent;
      }
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
        await reserveStock(
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
          channel: 'WEBSITE',
          customerId: identity.customerId ?? null,
          subTotal: pricing.subTotal,
          discountAmount: pricing.totalDiscount,
          totalAmount,
          couponCode: cart.couponCode,
          customerNote: dto.customerNote,
          codVerifiedAt: codOtpVerified ? new Date() : undefined,
          ipAddress: ip,
          deviceId: dto.deviceId,
          utmSource: dto.utmSource,
          utmMedium: dto.utmMedium,
          utmCampaign: dto.utmCampaign,
          utmTerm: dto.utmTerm,
          utmContent: dto.utmContent,
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
              toOrderAddressCreate(
                dto.shippingAddress,
                OrderAddressType.SHIPPING,
              ),
              toOrderAddressCreate(
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

    // Two independent advance-payment sources — the fraud gate's risk-based
    // trigger and the store-wide "always on" toggle (ADDENDUM Payments
    // parity), combined by taking whichever requires more. Both are
    // COD-specific — a bKash/Nagad/Rocket/Upay order is already a
    // prepayment channel, so there's nothing to require in advance of.
    const fraudRequired = requireAdvancePercent ? totalAmount.times(requireAdvancePercent).dividedBy(100) : null;
    const alwaysOnRequired =
      dto.paymentProvider === 'COD' ? await this.advancePayment.alwaysOnRequiredAmount(totalAmount) : null;
    const required =
      fraudRequired && alwaysOnRequired
        ? Decimal.max(fraudRequired, alwaysOnRequired)
        : (fraudRequired ?? alwaysOnRequired);

    if (required) {
      await this.advancePayment.require(order.id, required, fraudRequired ? 'high_risk' : 'store_wide');
      // Only a real risk-based trigger counts as a "fraud saving" — the
      // store-wide toggle applies to every order regardless of risk, so
      // crediting it here would inflate the ledger with non-fraud entries.
      if (fraudRequired) {
        await this.fraud.recordSaving(dto.shippingAddress.phone, required, 'advance_required', order.id);
      }
    }

    return this.getByIdInternal(order.id);
  }

  private async getByIdInternal(id: number) {
    const order = await this.prisma.client.order.findUniqueOrThrow({
      where: { id },
      include: ORDER_INCLUDE,
    });
    return toOrderDto(order);
  }

  private compactAddress(address: CheckoutAddressDto): string {
    return [address.addressLine, address.area, address.district, address.division, address.postCode]
      .filter((part): part is string => !!part?.trim())
      .join(', ');
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
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp || otp.attempts >= 5) throw new BadRequestException('Invalid or expired OTP');
    if (otp.code !== code) {
      await this.prisma.client.otp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw new BadRequestException('Invalid or expired OTP');
    }
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
