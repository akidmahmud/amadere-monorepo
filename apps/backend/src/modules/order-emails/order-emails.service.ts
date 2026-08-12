import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmailTemplatesService } from '../email-templates/email-templates.service';
import { EmailSettingsService } from '../email-settings/email-settings.service';
import { SmtpEmailProvider } from '../net-profit/cart-campaigns/providers/smtp-email.provider';

export interface OrderEmailResult {
  sent: boolean;
  reason?: string;
}

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: { addresses: true; items: true; payments: true };
}>;

// The single place that sends order/shipment/payment-lifecycle emails —
// OrdersService, ShipmentsService, ManualPaymentService, and CheckoutService
// each call one method here at their own real trigger point, rather than
// each independently assembling variables and calling EmailTemplatesService/
// SmtpEmailProvider themselves. Every method here follows the exact
// best-effort contract sendConfirmationEmail() (the method this whole
// service replaces) already established: never throw, log the outcome to
// OrderStatusHistory either way, return { sent, reason? } for the caller to
// surface if it wants to (most callers don't check it, same as before).
@Injectable()
export class OrderEmailsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailTemplates: EmailTemplatesService,
    private readonly emailSettings: EmailSettingsService,
    private readonly email: SmtpEmailProvider,
    private readonly config: ConfigService,
  ) {}

  async sendOrderPlaced(orderId: number, adminUserId?: number): Promise<OrderEmailResult> {
    return this.sendToCustomer('order_placed', orderId, adminUserId ?? null);
  }

  async sendNewOrderAdminNotice(orderId: number): Promise<OrderEmailResult> {
    const order = await this.loadOrder(orderId);
    if (!order) return { sent: false, reason: 'Order not found' };

    const settings = await this.emailTemplates.getSettings();
    const to =
      settings.orderNotificationEmail ||
      settings.contactEmail ||
      (await this.emailSettings.getConfig()).senderEmail;
    if (!to) return this.logOutcome(orderId, null, { sent: false, reason: 'No order notification email configured' });

    return this.renderAndSend('admin_new_order', to, this.buildOrderVariables(order), orderId, null);
  }

  async sendOrderConfirmed(orderId: number, adminUserId: number | null): Promise<OrderEmailResult> {
    return this.sendToCustomer('order_confirmed', orderId, adminUserId);
  }

  async sendOrderCanceled(orderId: number, adminUserId: number | null, reason?: string): Promise<OrderEmailResult> {
    return this.sendToCustomer('order_canceled', orderId, adminUserId, {
      cancellation_reason: reason || 'Not specified',
    });
  }

  async sendOrderShipped(orderId: number, trackingCode: string | null): Promise<OrderEmailResult> {
    const trackingLink = `${this.config.get<string>('STOREFRONT_BASE_URL') ?? ''}/track`;
    return this.sendToCustomer('order_shipped', orderId, null, {
      tracking_id: trackingCode || 'N/A',
      tracking_link: trackingLink,
    });
  }

  async sendOrderDelivered(orderId: number, adminUserId: number | null): Promise<OrderEmailResult> {
    return this.sendToCustomer('order_delivered', orderId, adminUserId);
  }

  async sendPaymentConfirmed(orderId: number, adminUserId: number): Promise<OrderEmailResult> {
    return this.sendToCustomer('payment_confirmed', orderId, adminUserId);
  }

  private async sendToCustomer(
    key: string,
    orderId: number,
    adminUserId: number | null,
    extraVariables: Record<string, string> = {},
  ): Promise<OrderEmailResult> {
    const order = await this.loadOrder(orderId);
    if (!order) return { sent: false, reason: 'Order not found' };

    const shipping = order.addresses.find((a) => a.type === 'SHIPPING');
    const to = shipping?.email;
    if (!to) return this.logOutcome(orderId, adminUserId, { sent: false, reason: 'No email on file' });

    const variables = { ...this.buildOrderVariables(order), ...extraVariables };
    return this.renderAndSend(key, to, variables, orderId, adminUserId);
  }

  private async renderAndSend(
    key: string,
    to: string,
    variables: Record<string, string>,
    orderId: number,
    adminUserId: number | null,
  ): Promise<OrderEmailResult> {
    const rendered = await this.emailTemplates.render(key, variables);
    if (!rendered) return this.logOutcome(orderId, adminUserId, { sent: false, reason: 'Template is disabled' });

    const result = await this.email.send(to, rendered.subject, this.stripHtml(rendered.html), { html: rendered.html });
    return this.logOutcome(
      orderId,
      adminUserId,
      result.failed ? { sent: false, reason: result.error } : { sent: true },
    );
  }

  private async logOutcome(
    orderId: number,
    adminUserId: number | null,
    result: OrderEmailResult,
  ): Promise<OrderEmailResult> {
    const order = await this.prisma.client.order.findUnique({ where: { id: orderId }, select: { status: true } });
    if (order) {
      await this.prisma.client.orderStatusHistory.create({
        data: {
          orderId,
          status: order.status,
          note: result.sent ? 'Order email sent to customer' : `Order email not sent: ${result.reason}`,
          adminUserId,
        },
      });
    }
    return result;
  }

  private async loadOrder(orderId: number): Promise<OrderWithRelations | null> {
    return this.prisma.client.order.findUnique({
      where: { id: orderId },
      include: {
        addresses: true,
        items: true,
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }

  private buildOrderVariables(order: OrderWithRelations): Record<string, string> {
    const shipping = order.addresses.find((a) => a.type === 'SHIPPING');
    return {
      order_id: order.orderNumber,
      customer_name: shipping?.recipientName ?? 'Customer',
      customer_phone: shipping?.phone ?? '',
      customer_address: [shipping?.addressLine, shipping?.area, shipping?.district].filter(Boolean).join(', '),
      product_list: this.buildProductListHtml(order.items),
      order_note: order.customerNote ?? '',
      payment_method: order.payments[0]?.provider ?? 'N/A',
      total: `${order.currency} ${order.totalAmount.toString()}`,
    };
  }

  private buildProductListHtml(items: OrderWithRelations['items']): string {
    return `<ul style="margin:0;padding-left:20px;">${items
      .map((i) => `<li>${i.productNameSnapshot} × ${i.quantity}</li>`)
      .join('')}</ul>`;
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}
