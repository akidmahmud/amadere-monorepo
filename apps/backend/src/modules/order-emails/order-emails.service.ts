import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, OrderStatus } from '@amader/db';
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
  private readonly logger = new Logger(OrderEmailsService.name);

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
    // Top-level try/catch (Fix 3): guarantees this public method never
    // throws, regardless of what fails inside — loadOrder(),
    // getSettings()/getConfig(), render(), or the SMTP send itself. `order`
    // is hoisted outside the try so the catch can still log a proper
    // outcome (with the real order status) when the failure happens after
    // the order was successfully loaded.
    let order: OrderWithRelations | null = null;
    try {
      order = await this.loadOrder(orderId);
      if (!order) return { sent: false, reason: 'Order not found' };

      const settings = await this.emailTemplates.getSettings();
      const to =
        settings.orderNotificationEmail ||
        settings.contactEmail ||
        (await this.emailSettings.getConfig()).senderEmail;
      if (!to) {
        return this.logOutcome('admin_new_order', orderId, order.status, null, { sent: false, reason: 'No order notification email configured' });
      }

      return await this.renderAndSend('admin_new_order', to, this.buildOrderVariables(order), orderId, order.status, null);
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Unexpected error sending admin order notice';
      this.logger.warn(`sendNewOrderAdminNotice failed for order ${orderId}: ${reason}`);
      const result: OrderEmailResult = { sent: false, reason };
      return order ? this.logOutcome('admin_new_order', orderId, order.status, null, result) : result;
    }
  }

  async sendOrderConfirmed(orderId: number, adminUserId: number | null): Promise<OrderEmailResult> {
    return this.sendToCustomer('order_confirmed', orderId, adminUserId);
  }

  async sendOrderCanceled(orderId: number, adminUserId: number | null, reason?: string): Promise<OrderEmailResult> {
    return this.sendToCustomer('order_canceled', orderId, adminUserId, {
      cancellation_reason: reason || 'Not specified',
    });
  }

  async sendOrderShipped(orderId: number, trackingCode: string | null, adminUserId: number | null): Promise<OrderEmailResult> {
    const trackingLink = `${this.config.get<string>('STOREFRONT_BASE_URL') ?? ''}/track`;
    return this.sendToCustomer('order_shipped', orderId, adminUserId, {
      tracking_id: trackingCode || 'N/A',
      tracking_link: trackingLink,
    });
  }

  async sendOrderDelivered(orderId: number, adminUserId: number | null): Promise<OrderEmailResult> {
    return this.sendToCustomer('order_delivered', orderId, adminUserId);
  }

  // amount is the amount actually just paid (e.g. a partial/advance
  // payment) — pre-formatted "{currency} {value}", same convention as
  // buildOrderVariables()'s own `total` field. Deliberately distinct from
  // the order's overall total, which the payment_confirmed template also
  // has access to via `total`.
  async sendPaymentConfirmed(orderId: number, adminUserId: number, amount: string): Promise<OrderEmailResult> {
    return this.sendToCustomer('payment_confirmed', orderId, adminUserId, { payment_amount: amount });
  }

  // Every public send* method funnels through here (directly, or via
  // sendNewOrderAdminNotice's own copy above) — this single top-level
  // try/catch (Fix 3) is what makes "no public method on this service can
  // ever throw" true for all of them at once, covering loadOrder(),
  // buildOrderVariables()/render() (via renderAndSend), and the SMTP send
  // itself (whose own pre-flight credentials read can throw before it
  // reaches its internal try/catch). `order` is hoisted outside the try so
  // a failure after a successful load can still be logged with the real
  // order status.
  private async sendToCustomer(
    key: string,
    orderId: number,
    adminUserId: number | null,
    extraVariables: Record<string, string> = {},
  ): Promise<OrderEmailResult> {
    let order: OrderWithRelations | null = null;
    try {
      order = await this.loadOrder(orderId);
      if (!order) return { sent: false, reason: 'Order not found' };

      const shipping = order.addresses.find((a) => a.type === 'SHIPPING');
      const to = shipping?.email;
      if (!to) return this.logOutcome(key, orderId, order.status, adminUserId, { sent: false, reason: 'No email on file' });

      const variables = { ...this.buildOrderVariables(order), ...extraVariables };
      return await this.renderAndSend(key, to, variables, orderId, order.status, adminUserId);
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Unexpected error sending order email';
      this.logger.warn(`sendToCustomer(${key}, order ${orderId}) failed: ${reason}`);
      const result: OrderEmailResult = { sent: false, reason };
      return order ? this.logOutcome(key, orderId, order.status, adminUserId, result) : result;
    }
  }

  // No try/catch here on purpose — render() and email.send() can both
  // throw, and that's fine: both callers above (sendToCustomer,
  // sendNewOrderAdminNotice) already wrap their entire call chain,
  // including this method, in their own top-level try/catch. A second,
  // narrower catch here would just be redundant with (and easy to drift
  // out of sync with) the outer one.
  private async renderAndSend(
    key: string,
    to: string,
    variables: Record<string, string>,
    orderId: number,
    status: OrderStatus,
    adminUserId: number | null,
  ): Promise<OrderEmailResult> {
    const rendered = await this.emailTemplates.render(key, variables);
    if (!rendered) return this.logOutcome(key, orderId, status, adminUserId, { sent: false, reason: 'Template is disabled' });

    const result = await this.email.send(to, rendered.subject, this.stripHtml(rendered.html), { html: rendered.html });
    return this.logOutcome(
      key,
      orderId,
      status,
      adminUserId,
      result.failed ? { sent: false, reason: result.error } : { sent: true },
    );
  }

  // Includes the specific template key in the note (Fix 1/2) so the admin
  // UI's history rows are distinguishable per event ("Order email
  // (order_confirmed) sent to customer" etc.) rather than identical text
  // across all 7 lifecycle events. Its own DB write is wrapped (Fix 3) —
  // this is the sole write on the failure path, so a transient DB error
  // here must not re-throw and undo the whole point of Fix 3's outer
  // try/catches; worst case we lose the audit row but still return the
  // correct { sent: false } result to the caller.
  private async logOutcome(
    key: string,
    orderId: number,
    status: OrderStatus,
    adminUserId: number | null,
    result: OrderEmailResult,
  ): Promise<OrderEmailResult> {
    try {
      await this.prisma.client.orderStatusHistory.create({
        data: {
          orderId,
          status,
          note: result.sent ? `Order email (${key}) sent to customer` : `Order email (${key}) not sent: ${result.reason}`,
          adminUserId,
        },
      });
    } catch (err) {
      this.logger.warn(
        `logOutcome failed to write order-email history for order ${orderId} (${key}): ${err instanceof Error ? err.message : String(err)}`,
      );
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

  // buildOrderVariables()/buildProductListHtml() feed customer-controlled
  // free text (name/address/note/product-name-snapshot) into an HTML email
  // — admin_new_order in particular renders customer_name/customer_address
  // into an internal admin mailbox, so unescaped input here is a real
  // injection vector, not just cosmetic. Every customer-controlled value
  // goes through escapeHtml(); values that are already-safe HTML this class
  // itself constructed (the `<ul>...</ul>` wrapper in buildProductListHtml)
  // are left alone — only the item name text inside each `<li>` is escaped.
  private buildOrderVariables(order: OrderWithRelations): Record<string, string> {
    const shipping = order.addresses.find((a) => a.type === 'SHIPPING');
    return {
      order_id: order.orderNumber,
      customer_name: this.escapeHtml(shipping?.recipientName ?? 'Customer'),
      customer_phone: this.escapeHtml(shipping?.phone ?? ''),
      customer_address: this.escapeHtml(
        [shipping?.addressLine, shipping?.area, shipping?.district].filter(Boolean).join(', '),
      ),
      product_list: this.buildProductListHtml(order.items),
      order_note: this.escapeHtml(order.customerNote ?? ''),
      payment_method: order.payments[0]?.provider ?? 'N/A',
      total: `${order.currency} ${order.totalAmount.toString()}`,
    };
  }

  private buildProductListHtml(items: OrderWithRelations['items']): string {
    return `<ul style="margin:0;padding-left:20px;">${items
      .map((i) => `<li>${this.escapeHtml(i.productNameSnapshot)} × ${i.quantity}</li>`)
      .join('')}</ul>`;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}
