import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
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
import { computeCheckoutFees } from '../net-profit/accounts/accounts.constants';
import { ShippingZonesService } from '../shipping-zones/shipping-zones.service';
import { ShippingRulesService } from '../shipping-rules/shipping-rules.service';
import { CheckoutDto } from './dto/checkout.dto';
import { CheckoutAddressDto } from './dto/checkout-address.dto';
import { RequestCodOtpDto } from './dto/request-cod-otp.dto';
import { CheckoutAbandonmentDto } from './dto/checkout-abandonment.dto';
import { RecoveryService } from '../net-profit/recovery/recovery.service';
import { OtpService } from '../auth/otp.service';
import { SmtpEmailProvider } from '../net-profit/cart-campaigns/providers/smtp-email.provider';
import { EmailTemplatesService } from '../email-templates/email-templates.service';
import { SettingsService } from '../settings/settings.service';
import { ConfigService } from '@nestjs/config';
import { ORDER_INCLUDE, OrderDto, toOrderDto } from './orders.mapper';
import { ORDER_CREATED_EVENT, OrderCreatedEvent } from './orders.events';
import { generateOrderNumber } from './order-number.util';
import { reserveStock } from './stock-reservation.util';
import { toOrderAddressCreate } from './order-address.util';
import { isDigitalOnly } from './digital-order.util';
import { OrderEmailsService } from '../order-emails/order-emails.service';
import { DownloadsService } from '../digital-products/downloads.service';
import { OrdersService } from './orders.service';
import { CheckoutAccountService } from './checkout-account.service';
import type { EnsureAccountResult } from './checkout-account.service';
import type { TokenPair } from '../../common/auth/token.types';
import { deriveAttribution } from './attribution.util';

const Decimal = Prisma.Decimal;

// Only present when a digital-only checkout with no logged-in customer just
// resolved (created or reused) a passwordless account — see
// CheckoutAccountService.ensureAccount. tokens is null when that resolution
// found a pre-existing verified (or password-protected) account instead of
// issuing a session — see the security note on ensureAccount for why.
export type CheckoutResultDto = OrderDto & {
  tokens?: TokenPair | null;
  existingAccount?: boolean;
  // Hosted-gateway handoff (bKash tokenized checkout). Present only when the
  // chosen provider needs the customer to finish paying somewhere else.
  paymentRedirectUrl?: string;
};

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly payments: PaymentsService,
    private readonly events: EventEmitter2,
    private readonly fraud: FraudService,
    private readonly blocker: BlockerService,
    private readonly advancePayment: AdvancePaymentService,
    private readonly otpSecurity: OtpSecurityService,
    // The single OTP implementation — see auth/otp.service.ts.
    private readonly otp: OtpService,
    private readonly sms: SmsService,
    private readonly orderEmails: OrderEmailsService,
    private readonly email: SmtpEmailProvider,
    private readonly emailTemplates: EmailTemplatesService,
    private readonly settings: SettingsService,
    private readonly config: ConfigService,
    private readonly shippingZones: ShippingZonesService,
    private readonly shippingRules: ShippingRulesService,
    private readonly downloads: DownloadsService,
    private readonly orders: OrdersService,
    private readonly checkoutAccount: CheckoutAccountService,
    private readonly recovery: RecoveryService,
  ) {}

  async requestCodOtp(
    identity: CartIdentity,
    dto: RequestCodOtpDto,
    ip?: string,
  ): Promise<void> {
    const otpSettings = await this.otpSecurity.getSettings();
    if (!otpSettings.codOtpEnabled) {
      throw new BadRequestException('COD OTP verification is currently disabled');
    }

    // ADDENDUM §I — evaluates the caller's IP for VPN/proxy; throws a
    // ForbiddenException itself when policy=block, so a blocked request
    // never even gets a real OTP row created.
    const vpnResult = await this.otpSecurity.evaluate(ip);

    // ONE issuing path for every OTP in the app (auth/otp.service.ts). This
    // used to hand-roll its own rate-limit count, code generator and
    // otp.create beside OtpService's identical versions -- two copies of the
    // same rules that had already drifted apart on identifier normalisation.
    const { code } = await this.otp.issue(dto.phone, 'COD_VERIFICATION', {
      length: otpSettings.codOtpLength,
      ttlMs: otpSettings.codOtpExpiryMinutes * 60 * 1000,
      ipAddress: ip,
      isVpn: vpnResult.isVpn,
    });
    // Delivery only — the Otp row above is keyed on the PHONE whichever
    // channel is used, because checkout() verifies with
    // verifyCodOtp(shippingAddress.phone, ...). Storing it under the email
    // would make a correct code fail verification.
    //
    // Falls back to SMS if EMAIL was asked for without an address, rather
    // than silently sending nothing.
    if (dto.channel === 'EMAIL' && dto.email) {
      // Server-side guard, not just a hidden control: the storefront hides
      // the picker when this is off, but the endpoint is public.
      if (!otpSettings.codOtpEmailEnabled) {
        throw new BadRequestException(
          'Email delivery is turned off for checkout verification. Please use SMS.',
        );
      }
      // Same admin-editable `customer_otp` template the signup/login codes
      // use, so the wording is maintained in one place for every OTP email.
      const rendered = await this.emailTemplates.render('customer_otp', {
        code,
        expiry_minutes: String(otpSettings.codOtpExpiryMinutes),
        logo_url: (await this.settings.getSiteInfo()).logoUrl ?? '',
        shop_url: this.config.get<string>('STOREFRONT_BASE_URL') ?? '',
      });
      const result = rendered
        ? await this.email.send(dto.email, rendered.subject, rendered.html, { html: rendered.html })
        : await this.email.send(
            dto.email,
            'Your order verification code',
            `Your order verification code is ${code}. It expires in ${otpSettings.codOtpExpiryMinutes} minutes.`,
          );
      if (result.failed) {
        // Loud, unlike the fire-and-forget SMS path: the customer is sitting
        // in front of the popup waiting, and a silent failure would leave
        // them entering a code that never arrives.
        throw new BadRequestException(
          'Could not send the code to that email address. Try SMS instead.',
        );
      }
      await this.markOtpSent(identity, dto);
      return;
    }
    await this.sms.sendTemplate('otp', dto.phone, 'EN', { code });
    await this.markOtpSent(identity, dto);
  }

  /**
   * The shopper pressed Place Order and a code actually reached them.
   *
   * Recorded at both delivery paths rather than next to the Otp row, because
   * the email path throws when delivery fails — and a code that never arrived
   * is not an OTP abandonment, it is a delivery failure. Someone who never
   * got the code did not choose to walk away.
   *
   * If they go on to verify, the order-created listener flips the same row to
   * recovered, so only the genuine drop-offs remain in the list.
   */
  private async markOtpSent(identity: CartIdentity, dto: RequestCodOtpDto): Promise<void> {
    await this.recovery.captureCheckoutStage(identity, {
      stage: 'otp',
      name: dto.name,
      phone: dto.phone,
      email: dto.email,
    });
  }

  /** Checkout-form beacon — see CheckoutAbandonmentDto. */
  async recordAbandonment(
    identity: CartIdentity,
    dto: CheckoutAbandonmentDto,
  ): Promise<void> {
    const { name, phone, email, ...address } = dto;
    await this.recovery.captureCheckoutStage(identity, {
      stage: 'checkout',
      name,
      phone,
      email,
      address,
    });
  }

  async checkout(
    identity: CartIdentity,
    dto: CheckoutDto,
    locale: Locale,
    ip?: string,
  ): Promise<CheckoutResultDto> {
    const cart = await this.findCart(identity, locale);
    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // A digital-only order has nothing to ship: no address, no stock hold,
    // no dispatch-queue entry. Mixed carts are deliberately excluded — any
    // physical line means there's still a parcel, so it behaves exactly as
    // it always has.
    const digitalOnly = isDigitalOnly(
      cart.items.map((i) => ({ productType: i.product.productType })),
    );
    if (!digitalOnly && !dto.shippingAddress) {
      throw new BadRequestException('A shipping address is required');
    }
    // A digital-only buyer with no session has no shippingAddress to supply
    // a name/email/phone either — createAccount is the one place those are
    // collected for this path (see CheckoutDto.createAccount).
    if (digitalOnly && !identity.customerId && !dto.createAccount) {
      throw new BadRequestException(
        'Name and an email or phone are required to receive a digital order',
      );
    }
    // Nothing is delivered, so there is no doorstep for cash to be collected
    // at — and a COD digital order would sit unpaid with its file locked
    // until staff manually completed it. The checkout UI hides COD for a
    // digital-only cart; this is the server-side half, since a client can
    // post whatever provider it likes.
    if (digitalOnly && dto.paymentProvider === 'COD') {
      throw new BadRequestException(
        'Cash on delivery is not available for digital products',
      );
    }

    // A digital order has no OrderAddress row (nothing to ship), so
    // shippingAddress can't supply contact details the way it does for a
    // physical order — createAccount is the fallback source. Used below to
    // feed the Net Profit blocker, which otherwise silently disables its
    // phone-blocklist, duplicate-order and new-customer-high-value rules for
    // every digital order (empty phone/email never matches anything).
    const contactPhone = dto.shippingAddress?.phone ?? dto.createAccount?.phone ?? '';
    const contactEmail = dto.shippingAddress?.email ?? dto.createAccount?.email ?? '';
    const contactName =
      dto.shippingAddress?.recipientName ??
      (dto.createAccount ? `${dto.createAccount.firstName} ${dto.createAccount.lastName}`.trim() : '');

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
      // Fraud protection still runs for a digital-only order — it's keyed on
      // phone, email, IP and device, all still collected (via createAccount
      // when there's no shippingAddress) — so empty strings only remain when
      // truly nothing was supplied, rather than being skipped outright.
      phone: contactPhone,
      email: contactEmail,
      ip: ip ?? '',
      deviceId: dto.deviceId ?? '',
      name: contactName,
      address: dto.shippingAddress ? this.compactAddress(dto.shippingAddress) : '',
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

    // Both COD gates below are courier-delivery concepts, and a digital-only
    // order is never handed to a courier: there is no delivery phone to send
    // an OTP to, and the fraud gate scores delivery-refusal risk for a parcel
    // that does not exist. Neither merely no-ops on this path — both read
    // `dto.shippingAddress?.phone ?? ''`, and FraudService.evaluate() throws
    // BadRequestException('Invalid Bangladeshi phone number') on an empty
    // one, which made a digital-only COD checkout impossible whenever fraud
    // detection was enabled. The Blocker above still runs on every order,
    // digital included — it reads contactPhone/contactEmail from
    // createAccount, so the real fraud protection for this path is untouched.
    if (!digitalOnly && dto.paymentProvider === 'COD') {
      const otpSettings = await this.otpSecurity.getSettings();

      // Net Profit courier fraud gate (CLAUDE.net-profit.md §7.2) — only
      // applies to COD, since a prepaid order carries no delivery-refusal
      // risk. No-ops entirely when the feature is disabled/set to "off".
      //
      // Runs BEFORE the OTP check, not after it as it used to. The gate is
      // now what decides whether this particular customer needs an OTP at
      // all (Fraud > "Require OTP for risky customers"), so asking for the
      // code first would mean demanding one from everybody — exactly the
      // behaviour that toggle exists to avoid. A blocked customer is also
      // rejected without being made to verify a phone first.
      const gate = await this.fraud.evaluateCheckoutGate(dto.shippingAddress?.phone ?? '');
      if (!gate.allowed) {
        const savingAmount = await this.fraud.savingAmountFor(pricing.total);
        await this.fraud.recordSaving(
          dto.shippingAddress?.phone ?? '',
          savingAmount,
          'auto_block',
        );
        await this.blocker.maybeAutoBlockFraud(dto.shippingAddress?.phone ?? '');
        throw new ForbiddenException(
          gate.blockMessage
            ? `${gate.blockMessage.en} / ${gate.blockMessage.bn}`
            : 'This order could not be placed.',
        );
      }
      if (gate.requireAdvancePercent) {
        requireAdvancePercent = gate.requireAdvancePercent;
      }

      // Two independent reasons to demand a code: the shop asks EVERY COD
      // customer for one, or this specific customer came back below the
      // fraud accept threshold.
      if (otpSettings.codOtpEnabled || gate.requiresOtp) {
        await this.verifyCodOtp(dto.shippingAddress?.phone ?? '', dto.codOtpCode);
        codOtpVerified = true;
      }
    }

    const voucher = dto.giftVoucherCode
      ? await this.validateVoucher(dto.giftVoucherCode)
      : null;
    const voucherAmount = voucher
      ? Decimal.min(voucher.remainingBalance, pricing.total)
      : new Decimal(0);
    const preFeeTotal = Decimal.max(
      pricing.total.minus(voucherAmount),
      new Decimal(0),
    );

    // Neither tax nor the COD fee are charged on an order — per explicit
    // request, both are internal accounting-only figures (Settings >
    // Accounts) and must never be added to what a customer actually pays —
    // see computeCheckoutFees's own comment. This order's taxAmount/codFee
    // are always 0.
    //
    // A digital-only order has nothing to ship. computeCheckoutFees already
    // early-returns 0 for freeShipping, so this needs no change to the
    // shared function and leaves the physical path untouched.
    const { shippingFee } = computeCheckoutFees(
      pricing.discounts.some((d) => d.freeShipping) || digitalOnly,
      dto.shippingAddress?.district,
      await this.shippingZones.getConfig(),
      // Only charged when the Shipping Rules toggle is on; returns null
      // otherwise, which leaves the zone rate exactly as it was.
      await this.shippingRules.checkoutFee(
        dto.shippingAddress?.district,
        cart.items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
        })),
      ),
    );
    const taxAmount = new Decimal(0);
    const codFee = new Decimal(0);
    const totalAmount = preFeeTotal.plus(shippingFee);

    // Resolved last, right before the order is created — DownloadsService.
    // createForOrder(order.id) (below) reads order.customerId, so an account
    // must exist before that row does. Skipped entirely once a session
    // (identity.customerId) is already present, and for any non-digital
    // order — a guest can still check out for physical delivery exactly as
    // before, unaffected by this feature.
    let resolvedCustomerId = identity.customerId;
    let checkoutAccountResult: EnsureAccountResult | null = null;
    if (digitalOnly && !identity.customerId && dto.createAccount) {
      checkoutAccountResult = await this.checkoutAccount.ensureAccount(dto.createAccount);
      resolvedCustomerId = checkoutAccountResult.customerId;
    }

    const order = await this.prisma.client.$transaction(async (tx) => {
      // A PDF has no stock to hold — skip the reservation loop entirely for
      // a digital-only order. Mixed carts still reserve every line, physical
      // included, exactly as before.
      if (!digitalOnly) {
        for (const item of cart.items) {
          await reserveStock(
            tx,
            item.productId,
            item.variantId,
            item.quantity,
          );
        }
      }

      const orderNumber = generateOrderNumber();
      // Channel and Source are derived rather than assumed. `channel` was
      // hardcoded to WEBSITE here, so a customer arriving from an
      // unparameterised Facebook link was recorded as generic web traffic with
      // a blank Source — while referrerDomain on the same row said
      // "m.facebook.com". Order.channel drives the Overview breakdown that ad
      // spend is decided from (see its schema comment), so that default was
      // not neutral, it was wrong.
      const attribution = deriveAttribution(
        { utmSource: dto.utmSource, referrerDomain: dto.referrerDomain },
        dto.landingDomain,
      );
      const created = await tx.order.create({
        data: {
          orderNumber,
          channel: attribution.channel,
          customerId: resolvedCustomerId ?? null,
          subTotal: pricing.subTotal,
          discountAmount: pricing.totalDiscount,
          taxAmount,
          codFee,
          shippingAmount: shippingFee,
          totalAmount,
          couponCode: cart.couponCode,
          customerNote: dto.customerNote,
          codVerifiedAt: codOtpVerified ? new Date() : undefined,
          ipAddress: ip,
          deviceId: dto.deviceId,
          // Falls back to the referring domain when the link carried no
          // utm_source, so the admin Source column shows "m.facebook.com"
          // instead of nothing.
          utmSource: attribution.utmSource,
          utmMedium: dto.utmMedium,
          utmCampaign: dto.utmCampaign,
          utmTerm: dto.utmTerm,
          utmContent: dto.utmContent,
          landingDomain: dto.landingDomain,
          landingPage: dto.landingPage,
          referrerUrl: dto.referrerUrl,
          referrerDomain: dto.referrerDomain,
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
                productTypeSnapshot: item.product.productType,
                unitPrice: priced.unitPrice,
                quantity: item.quantity,
              };
            }),
          },
          // Omitted entirely for a digital-only order — there is nothing to
          // deliver, so no SHIPPING/BILLING OrderAddress rows are created.
          // `dto.shippingAddress` is guaranteed present here whenever
          // `digitalOnly` is false (enforced by the guard clause above).
          ...(digitalOnly
            ? {}
            : {
                addresses: {
                  create: [
                    toOrderAddressCreate(
                      dto.shippingAddress!,
                      OrderAddressType.SHIPPING,
                    ),
                    toOrderAddressCreate(
                      dto.billingAddress ?? dto.shippingAddress!,
                      OrderAddressType.BILLING,
                    ),
                  ],
                },
              }),
          statusHistory: {
            create: { status: 'PENDING', note: 'Order placed' },
          },
        },
      });

      // A coupon that lost the "bigger wins" comparison to an upsell-bar
      // stage is still present in `discounts`, zeroed to amount 0 (see
      // PricingService.applyUpsellBar) — it contributed nothing to this
      // order, so don't burn one of its limited uses. FREE_SHIPPING coupons
      // legitimately compute amount 0 and are redeemed as before.
      const couponApplied = pricing.discounts.find(
        (d) =>
          d.source === 'COUPON' &&
          (d.amount.greaterThan(0) || d.freeShipping === true),
      );
      if (couponApplied && cart.couponCode) {
        const discount = await tx.discount.findUnique({
          where: { code: cart.couponCode },
        });
        if (discount) {
          await tx.discountRedemption.create({
            data: {
              discountId: discount.id,
              customerId: resolvedCustomerId,
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

      // NOTE: authorizing deliberately does NOT happen in here. A real
      // gateway (bKash) makes two HTTPS round trips to authorize, and holding
      // this transaction open across them risks a transaction timeout and
      // holds row locks for the duration. The Payment row is created just
      // after this block commits instead — see below.

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      await tx.cart.update({
        where: { id: cart.id },
        data: { couponCode: null },
      });

      return created;
    });

    // Authorize outside the transaction (see the note above). A gateway that
    // fails here leaves a real, PENDING-payment order rather than silently
    // rolling back stock and coupon redemptions the customer already
    // committed to — the same end state as an abandoned manual payment,
    // which admins already have a workflow for.
    let redirectUrl: string | undefined;
    // A free order has nothing to authorize. It used to be sent to the
    // provider anyway, so a ৳0 digital order picked up with bKash called the
    // gateway with amount 0, bKash rejected it, and the order was left
    // COMPLETED-but-payment-FAILED — alarming, and completely meaningless.
    // Recorded as CAPTURED instead: nothing is owed, so nothing is pending.
    if (totalAmount.equals(0)) {
      await this.prisma.client.payment.create({
        data: {
          orderId: order.id,
          provider: dto.paymentProvider,
          status: 'CAPTURED',
          amount: totalAmount,
        },
      });
    } else {
    try {
      const provider = await this.payments.resolve(dto.paymentProvider);
      const authResult = await provider.authorize(order.id, totalAmount);
      redirectUrl = authResult.redirectUrl;
      await this.prisma.client.payment.create({
        data: {
          orderId: order.id,
          provider: dto.paymentProvider,
          status: authResult.status,
          amount: totalAmount,
          transactionRef: authResult.transactionRef,
          rawResponse: (authResult.rawResponse as object) ?? undefined,
        },
      });
    } catch (err) {
      this.logger.error(
        `Payment authorize failed for order ${order.id} (${dto.paymentProvider}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      await this.prisma.client.payment.create({
        data: {
          orderId: order.id,
          provider: dto.paymentProvider,
          status: 'FAILED',
          amount: totalAmount,
          // Payment has no errorMessage column; rawResponse is where every
          // other provider outcome already lands, so the reason goes there
          // rather than costing a migration.
          rawResponse: {
            error: err instanceof Error ? err.message : String(err),
          },
        },
      });
    }
    }

    this.events.emit(ORDER_CREATED_EVENT, {
      orderId: order.id,
      customerId: resolvedCustomerId ?? null,
    } satisfies OrderCreatedEvent);

    // One locked DigitalDownload row per digital line, for every order (not
    // just digital-only ones) — a mixed cart's digital line still needs an
    // entitlement even though the order also ships something.
    await this.downloads.createForOrder(order.id);

    // A free digital order has no payment step, so it is already "paid".
    // Completing it matters beyond tidiness: profit.service.ts computes profit
    // ONLY on the transition to COMPLETED, so an order that never completes is
    // invisible in Net Profit while still showing in Order Manager.
    if (digitalOnly && totalAmount.equals(0)) {
      await this.downloads.unlockForOrder(order.id);
      await this.orders.updateStatus(
        order.id,
        { status: 'COMPLETED', note: 'Free digital order — delivered instantly' },
        null, // system-triggered, same convention as the courier webhook
      );
    }

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
        await this.fraud.recordSaving(dto.shippingAddress?.phone ?? '', required, 'advance_required', order.id);
      }
    }

    // Not for a hosted-gateway handoff. `redirectUrl` means the customer is
    // being sent to bKash and has not paid yet — telling them "we've received
    // your order" at this point is wrong, and it arrived even when they went
    // on to cancel the payment. BkashCallbackService sends both of these once
    // the payment actually captures.
    if (!redirectUrl) {
      await this.orderEmails.sendOrderPlaced(order.id);
      await this.orderEmails.sendNewOrderAdminNotice(order.id);
    }

    const orderDto = await this.getByIdInternal(order.id);
    // tokens/existingAccount are only ever set on the digital-only,
    // no-session branch above — every other checkout returns a plain
    // OrderDto, byte-for-byte the same response shape as before this
    // feature. The web app uses these to set the customer session cookies
    // and to choose "you're in" vs. "sign in to download" messaging.
    // `paymentRedirectUrl` is set only when the chosen provider is a hosted
    // gateway (today: bKash tokenized checkout). Every other provider leaves
    // it undefined and the response shape is unchanged, so the storefront can
    // treat "redirect if present, otherwise show the confirmation panel".
    return checkoutAccountResult
      ? {
          ...orderDto,
          tokens: checkoutAccountResult.tokens,
          existingAccount: checkoutAccountResult.existingAccount,
          paymentRedirectUrl: redirectUrl,
        }
      : { ...orderDto, paymentRedirectUrl: redirectUrl };
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
    // Same single implementation as every other OTP (auth/otp.service.ts).
    // This was a line-for-line copy of it that also skipped the identifier
    // normalisation OtpService does, so it only worked as long as every
    // caller happened to pass an already-normalised phone.
    //
    // The exception is deliberately translated. OtpService throws 401, and
    // the storefront's /api/backend proxy silently refreshes the session and
    // REPLAYS the request on a 401 -- a mistyped code would quietly resubmit
    // the whole checkout. A wrong code is a bad request, not an expired
    // session.
    try {
      await this.otp.verify(phone, code, 'COD_VERIFICATION');
    } catch {
      throw new BadRequestException('Invalid or expired OTP');
    }
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
