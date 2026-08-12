# Order Lifecycle Emails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire seven real order/shipment/payment events to real, admin-editable email templates via a new centralized `OrderEmailsService`, replacing the one hardcoded plain-text confirmation email that exists today.

**Architecture:** One new module (`order-emails`) owns all order-related sending — it's the only thing that talks to `EmailTemplatesService`/`SmtpEmailProvider` for order events. `OrdersService`, `ShipmentsService`, `ManualPaymentService`, and `CheckoutService` each inject it and call one method at their own real trigger point (verified against the actual current code, not assumed). No new database table — reuses the `EmailTemplate` engine and admin UI sub-project 1 built; just new seed rows (`ECOMMERCE` group) and one new field on the existing settings blob.

**Tech Stack:** NestJS + Prisma (backend, existing). No new dependencies.

## Global Constraints

- No unit test framework exists in this codebase. Verification is: `npx tsc --noEmit` clean, then live verification via real order/shipment/payment flows against the real running dev servers — never claim a task done without this.
- Dev servers (backend :3000, admin :3004, web :3001) are already running via `pnpm dev` from `h:\Amder Project\backend`, hot-reloading on save.
- Working directly on `master`, no worktree — matches sub-project 1.
- After any backend DTO/controller change, regenerate the admin app's OpenAPI types: `cd apps/admin && npm run typegen`.
- `Order.cancelReason` is a schema column nothing currently writes to — do not wire it up as part of this plan (out of scope, confirmed in the design spec). Cancellation reason comes from `UpdateOrderStatusDto.note` instead.
- `ManualPaymentService.verify()` has a second, separate code path (lines ~104-120) that writes `Order.status` directly via Prisma (bypassing `OrdersService.updateStatus()`) when a payment method's configured `orderStatusAfterVerify` applies. This plan's Order Confirmed/Canceled/Delivered hooks live inside `updateStatus()` only, per the design spec's trigger table — they will NOT fire for that alternate path. This is a known, pre-existing gap in a different part of the system, not something this plan fixes (fixing it would mean changing how payment verification interacts with stock reservation, well outside "add order emails").
- Every `OrderEmailsService` send method must never throw — matches the existing `sendConfirmationEmail()` convention exactly (best-effort, failure is logged not propagated) since email delivery must never fail the underlying order/shipment/payment action.

---

### Task 1: Settings field — `orderNotificationEmail`

**Files:**
- Modify: `apps/backend/src/modules/email-templates/email-templates.service.ts`
- Modify: `apps/backend/src/modules/email-templates/email-templates.mapper.ts`
- Modify: `apps/backend/src/modules/email-templates/dto/update-email-template-settings.dto.ts`
- Modify: `apps/admin/src/app/(shell)/settings/email-templates/page.tsx`

**Interfaces:**
- Produces: `EmailTemplateSettingsDto.orderNotificationEmail: string`, settable via the existing `PUT /admin/email-templates/settings` endpoint, readable via `EmailTemplatesService.getSettings()` — this is what Task 3's `sendNewOrderAdminNotice()` reads.

- [ ] **Step 1: Add the field to the settings JSON shape and defaults**

Open `apps/backend/src/modules/email-templates/email-templates.service.ts`. In the `EmailTemplateSettingsJson` interface, add one field:

```ts
interface EmailTemplateSettingsJson {
  logoMediaId: number | null;
  contactEmail: string;
  copyright: string;
  logoHeight: number;
  customCss: string;
  orderNotificationEmail: string;
}
```

In `SETTINGS_DEFAULTS`, add:

```ts
const SETTINGS_DEFAULTS: EmailTemplateSettingsJson = {
  logoMediaId: null,
  contactEmail: '',
  copyright: '',
  logoHeight: 40,
  customCss: '',
  orderNotificationEmail: '',
};
```

No other change needed in this file — `getSettings()`/`updateSettings()` already spread `EmailTemplateSettingsJson` generically, so the new field flows through automatically.

- [ ] **Step 2: Add the field to the response DTO**

Open `apps/backend/src/modules/email-templates/email-templates.mapper.ts`. In `EmailTemplateSettingsDto`, add:

```ts
export class EmailTemplateSettingsDto {
  @ApiProperty({ nullable: true }) logoMediaId!: number | null;
  @ApiProperty({ nullable: true }) logoUrl!: string | null;
  @ApiProperty() contactEmail!: string;
  @ApiProperty() copyright!: string;
  @ApiProperty() logoHeight!: number;
  @ApiProperty() customCss!: string;
  @ApiProperty() orderNotificationEmail!: string;
}
```

- [ ] **Step 3: Add the field to the update DTO**

Open `apps/backend/src/modules/email-templates/dto/update-email-template-settings.dto.ts`. Add, matching the existing `contactEmail` field's validators exactly:

```ts
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderNotificationEmail?: string;
```

(Add this as a new property inside the existing `UpdateEmailTemplateSettingsDto` class, after `customCss`.)

- [ ] **Step 4: Typecheck backend**

```bash
cd "h:\Amder Project\backend\apps\backend"
npx tsc --noEmit -p tsconfig.json
```

Expected: no output.

- [ ] **Step 5: Regenerate admin OpenAPI types**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/docs-json
```

Expected `200` (wait a few seconds for `nest start --watch` to recompile if not). Then:

```bash
cd "h:\Amder Project\backend\apps\admin"
npm run typegen
```

- [ ] **Step 6: Add the field to the Settings tab UI**

Open `apps/admin/src/app/(shell)/settings/email-templates/page.tsx`. In `SettingsTab`, add a new piece of state right after the existing `customCss` state:

```ts
  const [orderNotificationEmail, setOrderNotificationEmail] = useState<string | undefined>(undefined);
```

In `handleSave`'s mutation object, add (after `customCss`):

```ts
      orderNotificationEmail: orderNotificationEmail !== undefined ? orderNotificationEmail : undefined,
```

Add a new field to the form JSX, right after the "Contact email address" `<label>` block (before "Copyright" — grouping the two email-address fields together):

```tsx
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Order notification email</span>
        <input
          value={orderNotificationEmail !== undefined ? orderNotificationEmail : data.orderNotificationEmail}
          onChange={(e) => setOrderNotificationEmail(e.target.value)}
          placeholder="e.g: orders@yourstore.com"
          className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        />
        <span className="text-xs text-muted">
          Who gets notified when a new order comes in. Falls back to Contact Email, then the SMTP sender address, if left blank.
        </span>
      </label>
```

- [ ] **Step 7: Typecheck admin**

```bash
cd "h:\Amder Project\backend\apps\admin"
npx tsc --noEmit -p tsconfig.json
```

Expected: no output.

- [ ] **Step 8: Verify live**

Navigate to `http://localhost:3004/settings/email-templates`, Settings tab. Confirm the new "Order notification email" field renders with the help text, between Contact Email and Copyright. Type a test value (e.g. `orders-test@amadere.com`), click Save settings, reload the page, confirm it persisted. Then clear it back to empty and save again (leaving the setting in its default state, matching how sub-project 1 left its own test edits cleaned up).

- [ ] **Step 9: Commit**

```bash
cd "h:\Amder Project\backend"
git add apps/backend/src/modules/email-templates apps/admin/src/app/\(shell\)/settings/email-templates/page.tsx apps/admin/src/lib/api/schema.d.ts
git commit -m "$(cat <<'EOF'
Add orderNotificationEmail setting to Email Template Settings

New field for who receives the "new order" admin notice (built in
a later task of this plan) — falls back to Contact Email, then the
SMTP sender address, if left blank.
EOF
)"
```

---

### Task 2: Seed the 7 ECOMMERCE template rows

**Files:**
- Modify: `packages/db/prisma/seed.ts`

**Interfaces:**
- Produces: 7 new `EmailTemplate` rows with keys `order_placed`, `admin_new_order`, `order_confirmed`, `order_canceled`, `order_shipped`, `order_delivered`, `payment_confirmed` — all `group: 'ECOMMERCE'`, `canDisable: true`, `enabled: true`. These exact key strings are load-bearing: Task 3-6's `OrderEmailsService` calls `EmailTemplatesService.render(key, ...)` with these same literal strings.

- [ ] **Step 1: Add the seed block**

Open `packages/db/prisma/seed.ts`. Add this block right after the existing `emailTemplates` seeding loop from sub-project 1 (search for the closing `}` of the `for (const t of emailTemplates)` loop — add immediately after it, before the `Role` seeding block):

```ts
  console.log('Seeding order-lifecycle email templates...');
  const orderEmailTemplates: {
    key: string;
    title: string;
    description: string;
    subject: string;
    bodyHtml: string;
    variables: { key: string; description: string }[];
  }[] = [
    {
      key: 'order_placed',
      title: 'Order Placed',
      description: 'Send email to customer when they place an order',
      subject: 'Your order {{ order_id }} has been received',
      bodyHtml: `{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">Thanks for your order, {{ customer_name }}!</h2>
<p style="margin:0 0 16px;line-height:1.6;">We've received order <strong>{{ order_id }}</strong> and will confirm it shortly.</p>
<p style="margin:0 0 8px;font-weight:bold;color:#1e2b22;">Items</p>
{{ product_list }}
<p style="margin:16px 0 0;font-weight:bold;color:#1e2b22;">Total: {{ total }}</p>
<p style="margin:16px 0 0;color:#64766b;font-size:13px;">Payment method: {{ payment_method }}</p>
{{ footer }}`,
      variables: [
        { key: 'order_id', description: 'The order number' },
        { key: 'customer_name', description: "The customer's name" },
        { key: 'customer_phone', description: "The customer's phone number" },
        { key: 'customer_address', description: 'The shipping address' },
        { key: 'product_list', description: 'The ordered items, pre-rendered as an HTML list' },
        { key: 'order_note', description: "The customer's order note, if any" },
        { key: 'payment_method', description: 'The payment method used' },
        { key: 'total', description: 'The order total, with currency' },
      ],
    },
    {
      key: 'admin_new_order',
      title: 'New Order (Admin Notice)',
      description: 'Notify staff by email when a new order is placed',
      subject: 'New order {{ order_id }} received',
      bodyHtml: `{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">New order {{ order_id }}</h2>
<p style="margin:0 0 4px;"><strong>Customer:</strong> {{ customer_name }} ({{ customer_phone }})</p>
<p style="margin:0 0 16px;"><strong>Address:</strong> {{ customer_address }}</p>
<p style="margin:0 0 8px;font-weight:bold;color:#1e2b22;">Items</p>
{{ product_list }}
<p style="margin:16px 0 0;font-weight:bold;color:#1e2b22;">Total: {{ total }}</p>
<p style="margin:16px 0 0;color:#64766b;font-size:13px;">Payment method: {{ payment_method }}</p>
{{ footer }}`,
      variables: [
        { key: 'order_id', description: 'The order number' },
        { key: 'customer_name', description: "The customer's name" },
        { key: 'customer_phone', description: "The customer's phone number" },
        { key: 'customer_address', description: 'The shipping address' },
        { key: 'product_list', description: 'The ordered items, pre-rendered as an HTML list' },
        { key: 'order_note', description: "The customer's order note, if any" },
        { key: 'payment_method', description: 'The payment method used' },
        { key: 'total', description: 'The order total, with currency' },
      ],
    },
    {
      key: 'order_confirmed',
      title: 'Order Confirmed',
      description: 'Send to customer when their order is confirmed',
      subject: 'Your order {{ order_id }} has been confirmed',
      bodyHtml: `{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">Your order is confirmed</h2>
<p style="margin:0 0 16px;line-height:1.6;">Hi {{ customer_name }}, order <strong>{{ order_id }}</strong> has been confirmed and is being prepared.</p>
{{ product_list }}
<p style="margin:16px 0 0;font-weight:bold;color:#1e2b22;">Total: {{ total }}</p>
{{ footer }}`,
      variables: [
        { key: 'order_id', description: 'The order number' },
        { key: 'customer_name', description: "The customer's name" },
        { key: 'customer_phone', description: "The customer's phone number" },
        { key: 'customer_address', description: 'The shipping address' },
        { key: 'product_list', description: 'The ordered items, pre-rendered as an HTML list' },
        { key: 'order_note', description: "The customer's order note, if any" },
        { key: 'payment_method', description: 'The payment method used' },
        { key: 'total', description: 'The order total, with currency' },
      ],
    },
    {
      key: 'order_canceled',
      title: 'Order Canceled',
      description: 'Send to customer when their order is canceled',
      subject: 'Your order {{ order_id }} has been canceled',
      bodyHtml: `{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">Your order has been canceled</h2>
<p style="margin:0 0 16px;line-height:1.6;">Hi {{ customer_name }}, order <strong>{{ order_id }}</strong> has been canceled.</p>
<p style="margin:0 0 16px;color:#64766b;"><strong>Reason:</strong> {{ cancellation_reason }}</p>
{{ product_list }}
{{ footer }}`,
      variables: [
        { key: 'order_id', description: 'The order number' },
        { key: 'customer_name', description: "The customer's name" },
        { key: 'customer_phone', description: "The customer's phone number" },
        { key: 'customer_address', description: 'The shipping address' },
        { key: 'product_list', description: 'The ordered items, pre-rendered as an HTML list' },
        { key: 'cancellation_reason', description: 'Why the order was canceled' },
        { key: 'total', description: 'The order total, with currency' },
      ],
    },
    {
      key: 'order_shipped',
      title: 'Order Shipped',
      description: 'Send to customer when their order is dispatched to a courier',
      subject: 'Your order {{ order_id }} is on its way',
      bodyHtml: `{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">Your order is on its way!</h2>
<p style="margin:0 0 16px;line-height:1.6;">Hi {{ customer_name }}, order <strong>{{ order_id }}</strong> has been handed to our courier.</p>
<p style="margin:0 0 4px;"><strong>Tracking ID:</strong> {{ tracking_id }}</p>
<p style="margin:0 0 16px;">Track it any time at <a href="{{ tracking_link }}">{{ tracking_link }}</a>.</p>
{{ product_list }}
{{ footer }}`,
      variables: [
        { key: 'order_id', description: 'The order number' },
        { key: 'customer_name', description: "The customer's name" },
        { key: 'customer_phone', description: "The customer's phone number" },
        { key: 'customer_address', description: 'The shipping address' },
        { key: 'product_list', description: 'The ordered items, pre-rendered as an HTML list' },
        { key: 'tracking_id', description: 'The courier tracking code' },
        { key: 'tracking_link', description: 'Link to the storefront order-tracking page' },
        { key: 'total', description: 'The order total, with currency' },
      ],
    },
    {
      key: 'order_delivered',
      title: 'Order Delivered',
      description: 'Send to customer when their order is delivered',
      subject: 'Your order {{ order_id }} has been delivered',
      bodyHtml: `{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">Your order has arrived!</h2>
<p style="margin:0 0 16px;line-height:1.6;">Hi {{ customer_name }}, order <strong>{{ order_id }}</strong> has been delivered. We hope you love it!</p>
{{ product_list }}
{{ footer }}`,
      variables: [
        { key: 'order_id', description: 'The order number' },
        { key: 'customer_name', description: "The customer's name" },
        { key: 'customer_phone', description: "The customer's phone number" },
        { key: 'customer_address', description: 'The shipping address' },
        { key: 'product_list', description: 'The ordered items, pre-rendered as an HTML list' },
        { key: 'total', description: 'The order total, with currency' },
      ],
    },
    {
      key: 'payment_confirmed',
      title: 'Payment Confirmed',
      description: "Send to customer when their manual payment is verified",
      subject: "We've received your payment for order {{ order_id }}",
      bodyHtml: `{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">Payment received</h2>
<p style="margin:0 0 16px;line-height:1.6;">Hi {{ customer_name }}, we've confirmed your payment for order <strong>{{ order_id }}</strong>.</p>
<p style="margin:0 0 16px;font-weight:bold;color:#1e2b22;">Amount: {{ total }}</p>
{{ footer }}`,
      variables: [
        { key: 'order_id', description: 'The order number' },
        { key: 'customer_name', description: "The customer's name" },
        { key: 'customer_phone', description: "The customer's phone number" },
        { key: 'customer_address', description: 'The shipping address' },
        { key: 'product_list', description: 'The ordered items, pre-rendered as an HTML list' },
        { key: 'total', description: 'The order total, with currency' },
      ],
    },
  ];
  for (const t of orderEmailTemplates) {
    await prisma.emailTemplate.upsert({
      where: { key: t.key },
      create: {
        key: t.key,
        group: 'ECOMMERCE',
        title: t.title,
        description: t.description,
        subject: t.subject,
        bodyHtml: t.bodyHtml,
        defaultSubject: t.subject,
        defaultBodyHtml: t.bodyHtml,
        variables: t.variables,
        canDisable: true,
        enabled: true,
      },
      // Same "never overwrite a live edit on re-seed" rule as the sub-project 1 seed block.
      update: {},
    });
  }
```

- [ ] **Step 2: Run the seed**

```bash
cd "h:\Amder Project\backend\packages\db"
npx prisma db seed
```

Expected: `Seeding order-lifecycle email templates...` in the output, no errors.

- [ ] **Step 3: Verify live**

```bash
docker exec backend-postgres-1 psql -U amader -d amader_migration -c "SELECT key, \"group\", can_disable, enabled FROM email_templates WHERE \"group\" = 'ECOMMERCE' ORDER BY id;"
```

Expected: 7 rows, all `group=ECOMMERCE`, `can_disable=t`, `enabled=t`.

Navigate to `http://localhost:3004/settings/email-templates` (Templates tab). Confirm a new "Ecommerce" section now renders with all 7 templates listed, each with a working Edit link. Switch to the Status tab — confirm all 7 show enabled, interactive (not disabled) toggles this time, since `canDisable: true` — unlike sub-project 1's Base/ACL rows.

- [ ] **Step 4: Commit**

```bash
cd "h:\Amder Project\backend"
git add packages/db/prisma/seed.ts
git commit -m "$(cat <<'EOF'
Seed 7 order-lifecycle email templates (ECOMMERCE group)

order_placed, admin_new_order, order_confirmed, order_canceled,
order_shipped, order_delivered, payment_confirmed — all toggleable,
enabled by default. Nothing sends through them yet; that's the rest
of this plan.
EOF
)"
```

---

### Task 3: `OrderEmailsService` + wire Order Placed / New Order Admin Notice

**Files:**
- Create: `apps/backend/src/modules/order-emails/order-emails.service.ts`
- Create: `apps/backend/src/modules/order-emails/order-emails.module.ts`
- Modify: `apps/backend/src/modules/orders/orders.service.ts` (delete `sendConfirmationEmail`)
- Modify: `apps/backend/src/modules/orders/orders.module.ts`
- Modify: `apps/backend/src/modules/orders/checkout.service.ts`
- Modify: `apps/backend/src/modules/orders/admin-order-creation.service.ts`
- Modify: `apps/backend/src/modules/orders/admin-orders.controller.ts`

**Interfaces:**
- Consumes: `EmailTemplatesService.render(key, variables)` / `.getSettings()` (sub-project 1), `EmailSettingsService.getConfig()` (existing), `SmtpEmailProvider.send(to, subject, text, { html })` (existing), `PrismaService` (global).
- Produces: `OrderEmailsService` with public methods `sendOrderPlaced(orderId, adminUserId?)`, `sendNewOrderAdminNotice(orderId)`, `sendOrderConfirmed(orderId, adminUserId)`, `sendOrderCanceled(orderId, adminUserId, reason?)`, `sendOrderShipped(orderId, trackingCode)`, `sendOrderDelivered(orderId, adminUserId)`, `sendPaymentConfirmed(orderId, adminUserId)` — all `Promise<{ sent: boolean; reason?: string }>`, all safe to call unconditionally (never throw). Tasks 4-6 call the remaining methods at their own trigger points.

- [ ] **Step 1: Write `OrderEmailsService`**

Create `apps/backend/src/modules/order-emails/order-emails.service.ts`:

```ts
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
```

- [ ] **Step 2: Write the module**

Create `apps/backend/src/modules/order-emails/order-emails.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { EmailTemplatesModule } from '../email-templates/email-templates.module';
import { EmailSettingsModule } from '../email-settings/email-settings.module';
import { SmtpEmailProvider } from '../net-profit/cart-campaigns/providers/smtp-email.provider';
import { OrderEmailsService } from './order-emails.service';

@Module({
  imports: [EmailTemplatesModule, EmailSettingsModule],
  // SmtpEmailProvider is stateless — re-provided here rather than importing
  // the whole CartCampaignsModule for one class, same pattern OrdersModule
  // already used for it.
  providers: [OrderEmailsService, SmtpEmailProvider],
  exports: [OrderEmailsService],
})
export class OrderEmailsModule {}
```

- [ ] **Step 3: Delete `OrdersService.sendConfirmationEmail()` and its now-unused `email` dependency**

Open `apps/backend/src/modules/orders/orders.service.ts`.

Delete the import at line 17:
```ts
import { SmtpEmailProvider } from '../net-profit/cart-campaigns/providers/smtp-email.provider';
```

In the constructor, replace:
```ts
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly pricing: PricingService,
    private readonly email: SmtpEmailProvider,
    private readonly events: EventEmitter2,
  ) {}
```
with:
```ts
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly pricing: PricingService,
    private readonly events: EventEmitter2,
    private readonly orderEmails: OrderEmailsService,
  ) {}
```

Add the import for `OrderEmailsService` near the other cross-module imports at the top of the file:
```ts
import { OrderEmailsService } from '../order-emails/order-emails.service';
```

Delete the entire `sendConfirmationEmail` method — its comment block, the method itself, and the blank line after it (currently the block starting `// Best-effort — SmtpEmailProvider never throws...` through the closing `}` right before `async myList(`). Read the file first to get exact current line numbers before deleting — Task 1/2 of this plan didn't touch this file, so the method should be at the same location described in this plan's research (roughly lines 383-419), but confirm by reading before deleting rather than assuming line numbers stayed put.

- [ ] **Step 4: Wire the "Order Confirmed" family stays for Task 4 — for now just confirm the file still compiles with the constructor change**

(No status-transition hook yet — that's Task 4. This step is just making sure the constructor/import edit alone is self-consistent before moving on.)

```bash
cd "h:\Amder Project\backend\apps\backend"
npx tsc --noEmit -p tsconfig.json
```

Expected: errors about `OrderEmailsModule` not being registered yet in `orders.module.ts`, and about `checkout.service.ts`/`admin-order-creation.service.ts`/`admin-orders.controller.ts` still calling the now-deleted `sendConfirmationEmail` — this is expected at this point in the task; continue to the remaining steps before re-checking.

- [ ] **Step 5: Register `OrderEmailsModule` in `OrdersModule`, drop the now-redundant direct `SmtpEmailProvider` provider**

Open `apps/backend/src/modules/orders/orders.module.ts`. Add the import:
```ts
import { OrderEmailsModule } from '../order-emails/order-emails.module';
```
Add `OrderEmailsModule` to the `imports` array (alongside the existing `EmailSettingsModule`, etc.). Remove `SmtpEmailProvider` from the `providers` array and delete its now-unused import line (`import { SmtpEmailProvider } from '../net-profit/cart-campaigns/providers/smtp-email.provider';`) — nothing in `OrdersModule` talks to SMTP directly anymore now that `OrderEmailsService` owns that.

- [ ] **Step 6: Wire `checkout.service.ts`**

Open `apps/backend/src/modules/orders/checkout.service.ts`. Replace the `OrdersService` import and constructor param with `OrderEmailsService`:

Replace:
```ts
import { OrdersService } from './orders.service';
```
with:
```ts
import { OrderEmailsService } from '../order-emails/order-emails.service';
```

Replace the constructor's `private readonly orders: OrdersService,` line with `private readonly orderEmails: OrderEmailsService,`.

Replace the single call site:
```ts
    await this.orders.sendConfirmationEmail(order.id);
```
with:
```ts
    await this.orderEmails.sendOrderPlaced(order.id);
    await this.orderEmails.sendNewOrderAdminNotice(order.id);
```

- [ ] **Step 7: Wire `admin-order-creation.service.ts`**

Open `apps/backend/src/modules/orders/admin-order-creation.service.ts`. Same pattern:

Replace:
```ts
import { OrdersService } from './orders.service';
```
with:
```ts
import { OrderEmailsService } from '../order-emails/order-emails.service';
```

Replace the constructor's `private readonly orders: OrdersService,` line with `private readonly orderEmails: OrderEmailsService,`.

Replace:
```ts
    await this.orders.sendConfirmationEmail(order.id, adminId);
```
with:
```ts
    await this.orderEmails.sendOrderPlaced(order.id, adminId);
    await this.orderEmails.sendNewOrderAdminNotice(order.id);
```

- [ ] **Step 8: Wire the admin "Resend confirmation" endpoint**

Open `apps/backend/src/modules/orders/admin-orders.controller.ts`. This controller keeps its existing `OrdersService` injection (used by many other endpoints) — just add `OrderEmailsService` alongside it.

Add the import:
```ts
import { OrderEmailsService } from '../order-emails/order-emails.service';
```

Add to the constructor (keep the existing two params, add a third):
```ts
  constructor(
    private readonly orders: OrdersService,
    private readonly orderCreation: AdminOrderCreationService,
    private readonly orderEmails: OrderEmailsService,
  ) {}
```

Replace the `resendConfirmation` handler's body:
```ts
  resendConfirmation(
    @Param('id', ParseIntPipe) id: number,
    @CurrentAdmin() admin: { id: number },
  ): Promise<{ sent: boolean; reason?: string }> {
    return this.orders.sendConfirmationEmail(id, admin.id);
  }
```
with:
```ts
  resendConfirmation(
    @Param('id', ParseIntPipe) id: number,
    @CurrentAdmin() admin: { id: number },
  ): Promise<{ sent: boolean; reason?: string }> {
    return this.orderEmails.sendOrderPlaced(id, admin.id);
  }
```

- [ ] **Step 9: Typecheck**

```bash
cd "h:\Amder Project\backend\apps\backend"
npx tsc --noEmit -p tsconfig.json
```

Expected: no output. If there's an error about `Prisma.OrderGetPayload` or the `OrderWithRelations` type not matching actual usage (e.g. a field access that doesn't exist on the generated type), read the actual error, check the real Prisma-generated `Order`/`OrderAddress`/`OrderItem`/`Payment` field names in `packages/db/src/generated/prisma/models/Order.ts` (and siblings), and correct the field access — don't guess.

- [ ] **Step 10: Verify live — place a real test order through the storefront**

Navigate to `http://localhost:3001` and place a real order through checkout (use a real email address you can check the outcome for via the admin panel/DB, e.g. a throwaway address — SMTP must be configured in Settings > Email for an actual send attempt; if it's not configured, `SmtpEmailProvider.send()` returns `{ failed: true, error: 'SMTP is not configured...' }`, which is still a valid, verifiable outcome).

After placing the order:
```bash
docker exec backend-postgres-1 psql -U amader -d amader_migration -c "SELECT id, order_number FROM orders ORDER BY id DESC LIMIT 1;"
```
Note the order id, then:
```bash
docker exec backend-postgres-1 psql -U amader -d amader_migration -c "SELECT status, note FROM order_status_history WHERE order_id = <the id> ORDER BY id DESC LIMIT 5;"
```
Expected: two new rows (or two "not sent" rows with a reason, if SMTP isn't configured) — one for `order_placed`, one for `admin_new_order`'s attempt.

Also verify the admin "Resend confirmation" endpoint still works: open the order in the admin panel's Order detail (or Order Manager), trigger a resend if the UI exposes it (check `OrderDetailModal`/order-manager UI for a "Resend" action — if none is wired to this specific endpoint in the UI, verify directly via a browser `fetch('/api/backend/admin/orders/<id>/resend-confirmation', { method: 'POST' })` call in an authenticated admin tab instead), and confirm another `order_status_history` row appears.

Clean up: if you placed a real test order for this, leave it — it's a legitimate real order in the dev DB same as other test orders already accumulated this session; no special cleanup needed beyond what's already this session's convention (only delete data you created specifically as throwaway noise, and note it if so).

- [ ] **Step 11: Commit**

```bash
cd "h:\Amder Project\backend"
git add apps/backend/src/modules/order-emails apps/backend/src/modules/orders apps/backend/src/modules/orders/checkout.service.ts apps/backend/src/modules/orders/admin-order-creation.service.ts apps/backend/src/modules/orders/admin-orders.controller.ts apps/backend/src/modules/orders/orders.module.ts apps/backend/src/modules/orders/orders.service.ts
git commit -m "$(cat <<'EOF'
Add OrderEmailsService; wire Order Placed + admin new-order notice

Replaces OrdersService.sendConfirmationEmail()'s hardcoded string
with a real render through the order_placed template, at all three
existing call sites (checkout, manual order creation, admin
Resend). Adds the new admin_new_order notice alongside it.
EOF
)"
```

---

### Task 4: Wire Order Confirmed / Canceled / Delivered

**Files:**
- Modify: `apps/backend/src/modules/orders/orders.service.ts`

**Interfaces:**
- Consumes: `OrderEmailsService.sendOrderConfirmed/sendOrderCanceled/sendOrderDelivered` (Task 3).

- [ ] **Step 1: Hook the three transitions in `updateStatus()`**

Open `apps/backend/src/modules/orders/orders.service.ts`. In `updateStatus()`, right after the `await this.prisma.client.$transaction(async (tx) => { ... });` block closes and before `this.events.emit(ORDER_STATUS_CHANGED_EVENT, ...)`, add:

```ts
    if (dto.status === 'CONFIRMED') {
      await this.orderEmails.sendOrderConfirmed(id, adminUserId);
    } else if (dto.status === 'CANCELED') {
      await this.orderEmails.sendOrderCanceled(id, adminUserId, dto.note);
    } else if (dto.status === 'COMPLETED') {
      await this.orderEmails.sendOrderDelivered(id, adminUserId);
    }
```

This sits inside the same "only runs on a real transition" guard the method already has (`if (order.status === dto.status) return this.reload(id);` at the top short-circuits before any of this), so it can't double-send on a redundant status write.

- [ ] **Step 2: Typecheck**

```bash
cd "h:\Amder Project\backend\apps\backend"
npx tsc --noEmit -p tsconfig.json
```

Expected: no output.

- [ ] **Step 3: Verify live — walk a real test order through the lifecycle**

Create a manual test order via the admin panel's New Order flow (`http://localhost:3004/orders/new`), or reuse the order from Task 3's verification. Note its id, then:

1. Change its status to `CONFIRMED` via the admin Order detail / Order Manager status dropdown.
2. Check the log:
   ```bash
   docker exec backend-postgres-1 psql -U amader -d amader_migration -c "SELECT status, note FROM order_status_history WHERE order_id = <id> ORDER BY id DESC LIMIT 3;"
   ```
   Expected: a new row noting the `order_confirmed` send attempt (sent or a clear skip reason), on top of the status-change row itself.
3. Change status to `COMPLETED`. Confirm a similar row for `order_delivered`.
4. On a SEPARATE test order (create a second throwaway one, or use a different existing test order — don't cancel the one you just completed, since `RELEASE_ON_CANCEL`/stock logic behaves differently depending on prior state and this plan isn't testing that), change status to `CANCELED` with a note like "Testing cancellation email" in the status-change dialog if the UI exposes a note field, or via a direct API call with `{ status: 'CANCELED', note: 'Testing cancellation email' }` if not. Confirm the logged row, and — if SMTP is configured and the order has a real email on file — confirm the actual received email shows "Testing cancellation email" as the reason (proving `dto.note` really flows through to `cancellation_reason`).

Clean up: no special cleanup needed for test orders created this way, consistent with Task 3.

- [ ] **Step 4: Commit**

```bash
cd "h:\Amder Project\backend"
git add apps/backend/src/modules/orders/orders.service.ts
git commit -m "$(cat <<'EOF'
Wire Order Confirmed/Canceled/Delivered emails to updateStatus()

Fires on the real transition into CONFIRMED/CANCELED/COMPLETED —
COMPLETED covers "delivered" regardless of source, since a courier-
webhook DELIVERED shipment status already auto-transitions the
order there via the existing ORDER_STATUS_ON_SHIPMENT_STATUS map.
EOF
)"
```

---

### Task 5: Wire Order Shipped

**Files:**
- Modify: `apps/backend/src/modules/courier/shipments.service.ts`
- Modify: `apps/backend/src/modules/courier/courier.module.ts`

**Interfaces:**
- Consumes: `OrderEmailsService.sendOrderShipped(orderId, trackingCode)` (Task 3).

- [ ] **Step 1: Register `OrderEmailsModule` in `CourierModule`**

Open `apps/backend/src/modules/courier/courier.module.ts`. Add the import:
```ts
import { OrderEmailsModule } from '../order-emails/order-emails.module';
```
Add `OrderEmailsModule` to the `imports` array (alongside the existing `OrdersModule`).

- [ ] **Step 2: Inject `OrderEmailsService` into `ShipmentsService`**

Open `apps/backend/src/modules/courier/shipments.service.ts`. Add the import:
```ts
import { OrderEmailsService } from '../order-emails/order-emails.service';
```
Add to the constructor (after the existing `courierSettings` param, before the provider params):
```ts
    private readonly courierSettings: CourierSettingsService,
    private readonly orderEmails: OrderEmailsService,
```

- [ ] **Step 3: Hook the dispatch-success path**

In `dispatch()`, inside the `if (result.success)` block, right before `return toShipmentDto(shipment);`, add:

```ts
      await this.orderEmails.sendOrderShipped(order.id, shipment.trackingCode);
```

(This goes after the existing `if (order.status === 'PENDING') { await this.orders.updateStatus(...); }` block, still inside the outer `if (result.success) { ... }`.)

- [ ] **Step 4: Typecheck**

```bash
cd "h:\Amder Project\backend\apps\backend"
npx tsc --noEmit -p tsconfig.json
```

Expected: no output.

- [ ] **Step 5: Verify — confirmed no courier credentials exist in this dev DB (checked directly: `SELECT key FROM settings WHERE key LIKE '%courier%' OR key LIKE '%steadfast%' OR key LIKE '%pathao%'` returns 0 rows), so a real end-to-end dispatch cannot be exercised here without adding real courier API credentials — which this task should NOT do (out of scope, and a real courier API call has real-world side effects/cost). Verify what's actually verifiable instead:**

1. Attempt a dispatch anyway via the admin panel (Order Manager's Consign action) on a test order. Expected: it fails with a clear courier-configuration error, thrown BEFORE reaching `shipment.create`/the `if (result.success)` block — confirm the failure happens at the provider-call step (`this.providers[dto.provider].createConsignment(...)`), not somewhere your new code touches. This confirms the hook's placement doesn't interfere with the existing (unconfigured-courier) error path.
2. Since the success path itself can't be exercised live, do a careful manual trace instead and record it in your report: re-read the final `dispatch()` method as committed, confirm `await this.orderEmails.sendOrderShipped(order.id, shipment.trackingCode);` sits inside the `if (result.success)` block, after the existing `if (order.status === 'PENDING') { ... }` sub-block, before `return toShipmentDto(shipment);` — and confirm `shipment` at that point is the real object returned from `prisma.client.shipment.create(...)` a few lines up (so `shipment.trackingCode` is a real, already-resolved value, not a promise or stale reference).
3. Be explicit in your report that this task's happy path is verified by code trace, not a live end-to-end send, and why (no courier credentials in this dev environment) — do not claim "verified live" for the success path if it wasn't.

- [ ] **Step 6: Commit**

```bash
cd "h:\Amder Project\backend"
git add apps/backend/src/modules/courier/shipments.service.ts apps/backend/src/modules/courier/courier.module.ts
git commit -m "$(cat <<'EOF'
Wire Order Shipped email to ShipmentsService.dispatch()

Fires once a shipment is successfully created with a courier
(shipment.status becomes DISPATCHED) — the one clear "this order
left the building" moment, distinct from Order.status transitions.
EOF
)"
```

---

### Task 6: Wire Payment Confirmed

**Files:**
- Modify: `apps/backend/src/modules/net-profit/manual-payment/manual-payment.service.ts`
- Modify: `apps/backend/src/modules/net-profit/manual-payment/manual-payment.module.ts`

**Interfaces:**
- Consumes: `OrderEmailsService.sendPaymentConfirmed(orderId, adminUserId)` (Task 3).

- [ ] **Step 1: Register `OrderEmailsModule` in `ManualPaymentModule`**

Open `apps/backend/src/modules/net-profit/manual-payment/manual-payment.module.ts`. Add the import:
```ts
import { OrderEmailsModule } from '../../order-emails/order-emails.module';
```
Add `OrderEmailsModule` to the `imports` array (alongside `AdvancePaymentModule`, `MediaModule`).

- [ ] **Step 2: Inject `OrderEmailsService` into `ManualPaymentService`**

Open `apps/backend/src/modules/net-profit/manual-payment/manual-payment.service.ts`. Add the import:
```ts
import { OrderEmailsService } from '../../order-emails/order-emails.service';
```
Add to the constructor:
```ts
  constructor(
    private readonly prisma: PrismaService,
    private readonly advancePayment: AdvancePaymentService,
    private readonly events: EventEmitter2,
    private readonly orderEmails: OrderEmailsService,
  ) {}
```

- [ ] **Step 3: Hook the capture path**

In `verify()`, right after the block that sets `Payment.status → CAPTURED`:
```ts
    if (payment && payment.status === 'PENDING') {
      await this.prisma.client.payment.update({
        where: { id: payment.id },
        data: { status: 'CAPTURED', transactionRef: submission.trxId },
      });
    }
```
add:
```ts
    if (payment && payment.status === 'PENDING') {
      await this.orderEmails.sendPaymentConfirmed(submission.orderId, adminUserId);
    }
```

(Two separate `if` blocks reading `payment.status === 'PENDING'` — write it this way, not merged into the existing block above, since the email should only fire when the capture genuinely just happened in THIS call, and merging risks accidentally reading `payment.status` after it's already been mutated to `'CAPTURED'` a few lines up if the two blocks get reordered later; keeping them as two clearly-separate checks against the same pre-mutation snapshot is the safer, more obviously-correct shape here even though it repeats the condition.)

- [ ] **Step 4: Typecheck**

```bash
cd "h:\Amder Project\backend\apps\backend"
npx tsc --noEmit -p tsconfig.json
```

Expected: no output.

- [ ] **Step 5: Verify live — submit and verify a real manual payment**

This dev DB already has a real `PaymentMethodConfig` row for BKASH with `orderStatusAfterVerify = CONFIRMED` (checked directly: `SELECT provider, order_status_after_verify FROM payment_method_configs` returns exactly one row, `BKASH | CONFIRMED`). That means using a bKash test payment will ALSO exercise the pre-existing direct-Prisma order-status write this plan's Global Constraints already flagged (lines ~104-120 of `manual-payment.service.ts`, which bypasses `OrdersService.updateStatus()`). Concretely: after verifying a bKash payment on a PENDING/HOLD order, expect the order to jump to CONFIRMED status AND the `payment_confirmed` email to fire correctly (this task's hook) — but do NOT expect an `order_confirmed` email (Task 4's hook) to also fire for that same transition, since it went through the bypass path, not `updateStatus()`. That's the known, accepted gap, not a bug in this task's work — don't "fix" it as a surprise scope addition if you notice it.

Using a test order (status PENDING or HOLD), submit a manual bKash payment (via the storefront's manual-payment submission flow, or directly if there's an admin-side "record payment" path) with a real transaction ID matching bKash's pattern, then verify it via the admin Payments page's verify action.

```bash
docker exec backend-postgres-1 psql -U amader -d amader_migration -c "SELECT status, note FROM order_status_history WHERE order_id = <id> ORDER BY id DESC LIMIT 3;"
```
Expected: a row for the `payment_confirmed` send attempt.

Also confirm the `Payment.status` actually reads `CAPTURED` after verification (pre-existing behavior, not new, but worth confirming as a sanity check that this task's edit didn't interfere with anything above it):
```bash
docker exec backend-postgres-1 psql -U amader -d amader_migration -c "SELECT status FROM payments WHERE order_id = <id> ORDER BY created_at DESC LIMIT 1;"
```

- [ ] **Step 6: Commit**

```bash
cd "h:\Amder Project\backend"
git add apps/backend/src/modules/net-profit/manual-payment/manual-payment.service.ts apps/backend/src/modules/net-profit/manual-payment/manual-payment.module.ts
git commit -m "$(cat <<'EOF'
Wire Payment Confirmed email to ManualPaymentService.verify()

Fires when a manual payment submission's underlying Payment row
actually transitions PENDING -> CAPTURED — the only real code path
that sets a Payment to CAPTURED anywhere in this backend today (no
live online-gateway integration exists yet).
EOF
)"
```
