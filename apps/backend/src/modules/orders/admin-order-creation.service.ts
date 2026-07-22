import { BadRequestException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Locale, OrderAddressType, Prisma } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PricingService } from '../cart/pricing.service';
import { PaymentsService } from '../payments/payments.service';
import { CreateManualOrderDto } from './dto/create-manual-order.dto';
import { generateOrderNumber } from './order-number.util';
import { reserveStock } from './stock-reservation.util';
import { toOrderAddressCreate } from './order-address.util';
import { ORDER_INCLUDE, OrderDto, toOrderDto } from './orders.mapper';
import { ORDER_CREATED_EVENT, OrderCreatedEvent } from './orders.events';

const Decimal = Prisma.Decimal;

// Staff-facing "create order over the phone" path — deliberately does not
// call FraudService/BlockerService/OtpSecurityService/AdvancePaymentService
// (docs/superpowers/specs/2026-07-18-new-order-panel-design.md, Non-goals):
// those gates exist to catch bots/fake storefront submissions, not orders a
// staff member is directly taking from a verified customer. Emits the same
// ORDER_CREATED_EVENT real checkout does, so CustomerOrderEventListener's
// existing auto-match/create-by-phone logic (Customer Panel) handles the
// customer side with zero changes to that listener.
@Injectable()
export class AdminOrderCreationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly payments: PaymentsService,
    private readonly events: EventEmitter2,
  ) {}

  async create(dto: CreateManualOrderDto, adminId: number): Promise<OrderDto> {
    const products = await this.prisma.client.product.findMany({
      where: { id: { in: dto.items.map((i) => i.productId) } },
      include: {
        translations: { where: { locale: Locale.EN }, take: 1 },
        variants: true,
      },
    });
    const productsById = new Map(products.map((p) => [p.id, p]));

    for (const item of dto.items) {
      const product = productsById.get(item.productId);
      if (!product) {
        throw new BadRequestException(`Product #${item.productId} not found`);
      }
      if (item.variantId && !product.variants.some((v) => v.id === item.variantId)) {
        throw new BadRequestException(
          `Variant #${item.variantId} does not belong to product #${item.productId}`,
        );
      }
    }

    // Real, sale-window-aware price per line — same effectivePrice logic
    // storefront checkout uses (PricingService.priceLines).
    const pricedLines = await this.pricing.priceLines(
      dto.items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId ?? null,
        quantity: i.quantity,
      })),
    );

    const subTotal = pricedLines.reduce((sum, l) => sum.plus(l.lineTotal), new Decimal(0));
    const totalAmount = dto.items.reduce((sum, item, idx) => {
      const effective = item.unitPrice !== undefined ? new Decimal(item.unitPrice) : pricedLines[idx].unitPrice;
      return sum.plus(effective.times(item.quantity));
    }, new Decimal(0));
    const discountAmount = Decimal.max(subTotal.minus(totalAmount), new Decimal(0));

    const order = await this.prisma.client.$transaction(async (tx) => {
      for (const item of dto.items) {
        await reserveStock(tx, item.productId, item.variantId ?? null, item.quantity);
      }

      const created = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          channel: dto.channel,
          customerId: dto.customerId ?? null,
          subTotal,
          discountAmount,
          totalAmount,
          customerNote: dto.customerNote,
          items: {
            create: dto.items.map((item, idx) => {
              const product = productsById.get(item.productId)!;
              const variant = item.variantId
                ? product.variants.find((v) => v.id === item.variantId)
                : undefined;
              const effective =
                item.unitPrice !== undefined ? new Decimal(item.unitPrice) : pricedLines[idx].unitPrice;
              return {
                productId: item.productId,
                variantId: item.variantId ?? null,
                productNameSnapshot: product.translations[0]?.name ?? product.slug,
                skuSnapshot: variant?.sku ?? product.sku,
                unitPrice: effective,
                quantity: item.quantity,
              };
            }),
          },
          addresses: {
            create: [
              toOrderAddressCreate(dto.shippingAddress, OrderAddressType.SHIPPING),
              toOrderAddressCreate(dto.billingAddress ?? dto.shippingAddress, OrderAddressType.BILLING),
            ],
          },
          statusHistory: {
            create: { status: 'PENDING', note: 'Order created by staff', adminUserId: adminId },
          },
        },
      });

      const authResult = await this.payments.resolve(dto.paymentProvider).authorize(created.id, totalAmount);
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

      return created;
    });

    this.events.emit(ORDER_CREATED_EVENT, {
      orderId: order.id,
      customerId: dto.customerId ?? null,
    } satisfies OrderCreatedEvent);

    const full = await this.prisma.client.order.findUniqueOrThrow({
      where: { id: order.id },
      include: ORDER_INCLUDE,
    });
    return toOrderDto(full);
  }
}
