# Order Lifecycle Emails — Design Spec

## Context

Sub-project 1 (done, merged locally) built the Email Template System — a
database-backed template engine, render pipeline, and admin UI — but wired
nothing to it. The only transactional email anywhere in the codebase is
still `OrdersService.sendConfirmationEmail()`: a hardcoded plain-text
string, manually called from checkout, manual order creation, and an
admin "Resend" button.

This is sub-project 2 of the 4-part initiative: wire real order-lifecycle
events to real, admin-editable templates in the engine built in
sub-project 1. Scope and trigger points below were confirmed against the
actual code, not assumed — every trigger point cites the real file/method.

## Goals

- Seven new `ECOMMERCE`-group `EmailTemplate` rows: six customer-facing,
  one admin-facing.
- A new `OrderEmailsService` (new `order-emails` module) is the single
  place that assembles order data into template variables, calls
  `EmailTemplatesService.render()`, and sends via `SmtpEmailProvider` —
  `OrdersService`, `ShipmentsService`, `ManualPaymentService`, and
  `CheckoutService` each inject it and call one method at their own real
  trigger point, rather than duplicating this logic four times.
- `sendConfirmationEmail()`'s hardcoded string is replaced by a real
  render through the "Order Placed" template — same call sites (checkout,
  manual order creation, admin Resend), same `{ sent, reason }` contract,
  same `OrderStatusHistory` audit-note-on-either-outcome behavior it
  already has today (this convention is extended to all seven sends, not
  just this one).
- A new `orderNotificationEmail` field on the existing
  `EmailTemplateSettings` blob (from sub-project 1), with a fallback chain:
  `orderNotificationEmail || contactEmail || senderEmail`, skipping the
  admin-notify send (logged, not thrown) if all three are empty.

## Non-goals (this sub-project)

- Admin password reset (sub-project 3) and the contact form (sub-project
  4) — untouched here.
- No new Order/Shipment/Payment status values or state-machine changes —
  every trigger is an existing transition, only the "and now send an
  email" side-effect is new.
- No duplicate admin-facing template per event (e.g. no
  "Order Canceled — admin copy") — confirmed with the user: customer
  templates plus exactly one admin template (New Order), not a doubled-up
  set matching Botble's own list.
- No online-payment-gateway capture path — `Payment.status → CAPTURED`
  currently has exactly one real code path
  (`ManualPaymentService.verify()`, the proof-upload flow); that's the
  only "Payment Confirmed" trigger because it's the only one that exists.

## The seven templates and their trigger points

Every trigger point below was read directly from the current code, not
inferred from the legacy Botble config.

| # | Template key | Group | Recipient | Trigger | File / method |
|---|---|---|---|---|---|
| 1 | `order_placed` | ECOMMERCE | customer | Order created | `checkout.service.ts` (storefront checkout, ~line 350) and `admin-order-creation.service.ts` (`create()`, ~line 245) — both currently call `sendConfirmationEmail`; both switch to `OrderEmailsService.sendOrderPlaced(orderId)` |
| 2 | `admin_new_order` | ECOMMERCE | `orderNotificationEmail` setting (with fallback chain) | same as #1 | same call sites, one extra call |
| 3 | `order_confirmed` | ECOMMERCE | customer | `Order.status` transitions to `CONFIRMED` | `orders.service.ts`, `OrdersService.updateStatus()` |
| 4 | `order_canceled` | ECOMMERCE | customer | `Order.status` transitions to `CANCELED` | `orders.service.ts`, `OrdersService.updateStatus()` — `cancellation_reason` comes from `dto.note` (the same value already threaded into the `OrderStatusHistory` row on every status change); `Order.cancelReason` — a schema column that exists but nothing in the codebase currently writes to — stays untouched, since wiring it up is a separate, more invasive change this sub-project doesn't need just to source one email variable |
| 5 | `order_shipped` | ECOMMERCE | customer | Shipment successfully dispatched to a courier | `shipments.service.ts`, `ShipmentsService.dispatch()`, the `if (result.success)` branch (~line 213) |
| 6 | `order_delivered` | ECOMMERCE | customer | `Order.status` transitions to `COMPLETED` | `orders.service.ts`, `OrdersService.updateStatus()` — this single hook covers delivery regardless of source, since a courier webhook reporting `Shipment.status = DELIVERED` already auto-transitions the order to `COMPLETED` via the existing `ORDER_STATUS_ON_SHIPMENT_STATUS` map; `COMPLETED` **is** this system's "delivered" state, not a separate concept |
| 7 | `payment_confirmed` | ECOMMERCE | customer | A manual payment submission gets verified | `manual-payment.service.ts`, `ManualPaymentService.verify()`, right after `Payment.status → CAPTURED` |

Accepted, not a bug: COD orders (the majority) often get payment marked
captured around delivery time, so a customer may receive templates #6 and
#7 close together. They report genuinely different facts (delivery vs.
payment) and stay separate templates, matching the legacy system's own
split.

`updateStatus()` already no-ops when `order.status === dto.status`
(existing guard, `orders.service.ts`), so templates #3/#4/#6 can't
double-send on a redundant status write — the send call sits inside the
same guarded block that already runs exactly once per real transition.

## `OrderEmailsService`

New module `apps/backend/src/modules/order-emails/`, following this
codebase's established module shape (mapper-less here — no DTOs cross an
HTTP boundary, this service is called from other services, not a
controller).

```ts
@Injectable()
export class OrderEmailsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailTemplates: EmailTemplatesService,
    private readonly email: SmtpEmailProvider,
  ) {}

  async sendOrderPlaced(orderId: number, adminUserId?: number): Promise<{ sent: boolean; reason?: string }>;
  async sendNewOrderAdminNotice(orderId: number): Promise<{ sent: boolean; reason?: string }>;
  async sendOrderConfirmed(orderId: number, adminUserId: number | null): Promise<{ sent: boolean; reason?: string }>;
  async sendOrderCanceled(orderId: number, adminUserId: number | null, reason?: string): Promise<{ sent: boolean; reason?: string }>;
  async sendOrderShipped(orderId: number, trackingCode: string | null, provider: string): Promise<{ sent: boolean; reason?: string }>;
  async sendOrderDelivered(orderId: number, adminUserId: number | null): Promise<{ sent: boolean; reason?: string }>;
  async sendPaymentConfirmed(orderId: number, adminUserId: number): Promise<{ sent: boolean; reason?: string }>;
}
```

Every method follows the exact shape `sendConfirmationEmail()` already
established: look up the order (+ shipping address for the customer's
email, + items for the product list), skip-and-log if no email is on
file for a customer-facing send, call `EmailTemplatesService.render(key,
variables)`, send via `SmtpEmailProvider` if `render()` didn't return
`null` (template disabled), write one `OrderStatusHistory` row either way,
and never throw — email delivery is best-effort and must never fail the
underlying order/shipment/payment action.

A private `buildOrderVariables(order)` helper assembles the variable set
shared across most templates (`order_id`, `customer_name`,
`customer_phone`, `customer_address`, `product_list` — a pre-rendered
HTML fragment, following the same "can't loop in a flat substitution
template" convention `InvoiceTemplateSettingsService`'s
`itemsTableRows` already established — `order_note`, `payment_method`,
`total`); per-template extras (`tracking_id`, `tracking_link`,
`cancellation_reason`) are added by each specific `send*` method.

## Settings addition

`EmailTemplateSettingsJson` (in `email-templates.service.ts`) gains one
field: `orderNotificationEmail: string` (default `''`). `getSettings()`'s
existing shape extends naturally; the Email Template Settings admin page
(sub-project 1) gets one more text input. `sendNewOrderAdminNotice()`
resolves the recipient as
`settings.orderNotificationEmail || settings.contactEmail ||
(await this.emailSettings.getConfig()).senderEmail`, skipping the send
(logged, not thrown) if all three are empty.

## Testing / verification

No unit test framework in this codebase — verification is live, matching
every prior sub-project this session:
- Typecheck clean after each task.
- Live-verify each of the 7 triggers against the real dev DB: place a real
  test order, confirm the Order Placed + admin notice both send (or log a
  clear skip reason); walk it through Confirmed → Shipped → Delivered,
  confirming one email per transition; cancel a separate test order,
  confirming the cancellation email and reason; verify a real manual
  payment submission, confirming the payment-confirmed email.
- Confirm the existing `OrderStatusHistory` audit trail shows a row for
  every send attempt (success or skip), matching the current
  `sendConfirmationEmail()` behavior extended to all seven.
- Clean up every test order/payment created for verification afterward,
  per this session's established convention.
