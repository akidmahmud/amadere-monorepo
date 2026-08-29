import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@amader/db';
import { PaginatedResult, phoneLookupCandidates } from '@amader/shared';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { paginationArgs, toPaginatedResult } from '../../../common/pagination.util';
import { NetProfitSettingsService } from '../settings/net-profit-settings.service';
import { SmsService } from '../sms/sms.service';
import { CartCampaignsService } from '../cart-campaigns/cart-campaigns.service';
import { MergeTagsService } from '../merge-tags/merge-tags.service';
import { CART_UPDATED_EVENT } from '../../cart/cart.events';
import type { CartIdentity } from '../../cart/cart.service';
import type { CartUpdatedEvent } from '../../cart/cart.events';
import { ORDER_CREATED_EVENT } from '../../orders/orders.events';
import type { OrderCreatedEvent } from '../../orders/orders.events';
import { CheckoutAddressDto } from '../../orders/dto/checkout-address.dto';
import { toOrderAddressCreate } from '../../orders/order-address.util';
import { DownloadsService } from '../../digital-products/downloads.service';
import { IncompleteOrderDto, toIncompleteOrderDto } from './recovery.mapper';

const SETTINGS_NAMESPACE = 'recovery';

export interface RecoverySettings {
  enabled: boolean;
  delayHours: number;
  maxAttempts: number;
  quietHoursStart: number; // 0-23, server-local
  quietHoursEnd: number;
}

const RECOVERY_SETTINGS_DEFAULTS: RecoverySettings = {
  enabled: false,
  delayHours: 2,
  maxAttempts: 3,
  quietHoursStart: 22,
  quietHoursEnd: 8,
};

/**
 * Which outcomes to list.
 *
 * "open" is what the abandonment funnel is FOR: carts still worth chasing.
 * A recovered cart is a customer who bought, and a cancelled one is a cart
 * staff already closed — neither is work to do, and leaving both in the
 * default view meant someone who completed an order was still sitting in the
 * "Cart Abandonment" list, which is exactly what it says they did not do.
 *
 * Deliberately NOT defaulted inside buildWhere: the list wants "open" and the
 * CSV export wants "all" (an export defaulting to open would leave the
 * cancelReason column empty in every row, which is the opposite of why that
 * column exists). Each caller states its own default.
 */
export type RecoveryOutcome = 'open' | 'recovered' | 'cancelled' | 'all';

export interface RecoveryListFilters {
  outcome?: RecoveryOutcome;
  /**
   * @deprecated superseded by `outcome`, and now inert on the list and export
   * endpoints — both controllers always supply an `outcome`, which takes
   * precedence. Kept only for `clearAll`, which passes it through and then
   * forces `recovered: false` itself regardless.
   */
  recovered?: boolean;
  /** "cart" | "checkout" | "otp" | "payment" */
  stage?: string;
  q?: string;
  from?: string;
  to?: string;
}

export interface CartSnapshotItem {
  productId: number;
  /**
   * Which variant/pack, when the product has them. Optional because rows
   * captured before this field existed do not carry it — their price still
   * comes through `unitPrice` below, which was always the real one.
   */
  variantId?: number | null;
  name: string;
  slug: string;
  quantity: number;
  /** What the shopper was actually being charged, at capture time. */
  unitPrice: string;
  imageUrl: string | null;
}

/**
 * "2 x Gawa Ghee | 1 x Kalojira Honey" from the cart snapshot.
 *
 * Multiplication sign is a plain "x", not the U+00D7 the admin table uses:
 * this string goes into a CSV that people open in Excel, where a stray
 * non-ASCII character in an otherwise ASCII column is a reliable way to get
 * mojibake in someone's spreadsheet.
 */
function formatCartProducts(cart: unknown): string {
  const items = Array.isArray(cart) ? (cart as CartSnapshotItem[]) : [];
  return items
    .filter((i) => i && typeof i.name === 'string')
    .map((i) => `${i.quantity} x ${i.name}`)
    .join(' | ');
}

function csvField(value: string | number | boolean): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Same minimal quoted-field CSV parser used by BlockerService's import.
function parseCsv(text: string): string[][] {
  return text
    .split(/\r\n|\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const fields: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
          if (ch === '"' && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else if (ch === '"') {
            inQuotes = false;
          } else {
            cur += ch;
          }
        } else if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          fields.push(cur);
          cur = '';
        } else {
          cur += ch;
        }
      }
      fields.push(cur);
      return fields.map((f) => f.trim());
    });
}

// Captures via the existing `cart.updated` domain event — flagged as
// exactly this feature's hook since B5 (AGENTS.md: "PHASE 2 HOOK: abandoned-
// cart recovery ... via the cart.updated domain event"). Only captures the
// "cart" stage for now (the storefront doesn't yet emit a distinct
// checkout/payment-stage signal before an order completes) — a real,
// honest scope note, not a fake stage value.
@Injectable()
export class RecoveryService {
  private readonly logger = new Logger(RecoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: NetProfitSettingsService,
    private readonly sms: SmsService,
    private readonly campaigns: CartCampaignsService,
    private readonly mergeTags: MergeTagsService,
    private readonly downloads: DownloadsService,
  ) {}

  async getSettings(): Promise<RecoverySettings> {
    return this.settings.getNamespace(SETTINGS_NAMESPACE, RECOVERY_SETTINGS_DEFAULTS);
  }

  async updateSettings(dto: Partial<RecoverySettings>): Promise<RecoverySettings> {
    await this.settings.setNamespace(SETTINGS_NAMESPACE, dto);
    return this.getSettings();
  }

  /**
   * The IncompleteOrder for this cart, if it is still an OPEN one.
   *
   * `cartId` is unique, so without this there is exactly one abandonment row
   * per cart for all time — and both capture paths would happily rewrite a
   * row staff had already closed. Reported: a cart was cancelled with a
   * reason, the same customer came back and abandoned again, and instead of a
   * new row appearing the cancelled one silently had its products swapped
   * underneath the recorded reason. The new abandonment was invisible and the
   * old reason no longer described what it was attached to.
   *
   * A closed row (cancelled, or recovered) is therefore DETACHED rather than
   * reused: it keeps its history — reason, products as they were, recovered
   * order — and gives the cart id up so the caller can open a fresh row.
   * `cartId` is nullable and Postgres allows many NULLs under a unique
   * constraint, so any number of closed rows can coexist for one cart.
   *
   * Returns null when the caller should create a new row.
   */
  private async openRowForCart(cartId: number) {
    const existing = await this.prisma.client.incompleteOrder.findUnique({ where: { cartId } });
    if (!existing) return null;
    if (!existing.canceledAt && !existing.recovered) return existing;

    await this.prisma.client.incompleteOrder.update({
      where: { id: existing.id },
      data: { cartId: null },
    });
    return null;
  }

  @OnEvent(CART_UPDATED_EVENT)
  async onCartUpdated(event: CartUpdatedEvent): Promise<void> {
    const cart = await this.prisma.client.cart.findUnique({
      where: { id: event.cartId },
      include: {
        items: {
          include: {
            product: {
              include: {
                translations: { where: { locale: 'EN' }, take: 1 },
                media: { where: { isPrimary: true }, include: { media: true }, take: 1 },
              },
            },
          },
        },
        customer: true,
      },
    });
    if (!cart || cart.items.length === 0) return;

    const subtotal = cart.items.reduce((sum, i) => sum.plus(i.unitPriceSnapshot.times(i.quantity)), new Prisma.Decimal(0));
    const snapshot: CartSnapshotItem[] = cart.items.map((i) => ({
      productId: i.productId,
      variantId: i.variantId,
      name: i.product.translations[0]?.name ?? i.product.slug,
      slug: i.product.slug,
      quantity: i.quantity,
      unitPrice: i.unitPriceSnapshot.toString(),
      imageUrl: i.product.media[0]?.media.url ?? null,
    }));

    const existing = await this.openRowForCart(cart.id);
    if (existing) {
      await this.prisma.client.incompleteOrder.update({
        where: { id: existing.id },
        data: { cart: snapshot as unknown as Prisma.InputJsonValue, subtotal, lastSeenAt: new Date() },
      });
      return;
    }

    const created = await this.prisma.client.incompleteOrder.create({
      data: {
        cartId: cart.id,
        customerId: cart.customerId,
        phone: cart.customer?.phone,
        email: cart.customer?.email,
        cart: snapshot as unknown as Prisma.InputJsonValue,
        subtotal,
        stage: 'cart',
      },
    });
    // ADDENDUM §C2 — enqueue campaign steps once, at first capture, not on
    // every subsequent cart edit (scheduledAt is relative to *this*
    // moment, the real abandonment point).
    await this.campaigns.enqueueForIncomplete(created.id);
  }

  /**
   * Record how far a shopper got in checkout, with whatever contact details
   * they typed.
   *
   * The `cart.updated` listener above only ever learns a phone or email when
   * the shopper is SIGNED IN — a guest's row is created with all three
   * contact fields null, which makes it unrecoverable and therefore noise.
   * This is the other half: the checkout form is where a guest actually
   * identifies themselves, so the details are folded onto the same row (keyed
   * by cart) as they are entered.
   *
   * Upserts rather than inserts, so a shopper who reaches checkout and then
   * triggers an OTP produces ONE row that advances `cart` -> `checkout` ->
   * `otp`, not three rows to chase separately.
   */
  async captureCheckoutStage(
    identity: CartIdentity,
    input: {
      stage: 'checkout' | 'otp';
      name?: string;
      phone?: string;
      email?: string;
      /** Whatever of the shipping form is filled in so far. */
      address?: Record<string, string | undefined>;
    },
  ): Promise<void> {
    try {
      const cart = await this.prisma.client.cart.findFirst({
        where: identity.customerId
          ? { customerId: identity.customerId }
          : identity.guestToken
            ? { guestToken: identity.guestToken }
            : { id: -1 },
        include: {
          items: {
            include: {
              product: {
                include: {
                  translations: { where: { locale: 'EN' }, take: 1 },
                  media: { where: { isPrimary: true }, include: { media: true }, take: 1 },
                },
              },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });
      if (!cart || cart.items.length === 0) return;

      const subtotal = cart.items.reduce(
        (sum, i) => sum.plus(i.unitPriceSnapshot.times(i.quantity)),
        new Prisma.Decimal(0),
      );
      const snapshot: CartSnapshotItem[] = cart.items.map((i) => ({
        productId: i.productId,
        name: i.product.translations[0]?.name ?? i.product.slug,
        slug: i.product.slug,
        quantity: i.quantity,
        unitPrice: i.unitPriceSnapshot.toString(),
        imageUrl: i.product.media[0]?.media.url ?? null,
      }));

      // Never overwrite a known value with an empty one: the OTP request
      // carries a phone but no name, and it must not wipe the name the
      // checkout-stage capture already stored.
      const contact = {
        ...(input.name?.trim() ? { name: input.name.trim() } : {}),
        ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
        ...(input.email?.trim() ? { email: input.email.trim() } : {}),
      };

      // Only the parts actually typed. Merged over whatever is already
      // stored, for the same reason as the contact fields above: the OTP
      // request carries no address and must not erase the one the checkout
      // beacon captured a moment earlier.
      const typedAddress = Object.fromEntries(
        Object.entries(input.address ?? {})
          .map(([k, v]) => [k, typeof v === 'string' ? v.trim() : ''])
          .filter(([, v]) => v !== ''),
      );

      const existing = await this.openRowForCart(cart.id);

      if (existing) {
        // Stage only ever moves FORWARD. A late cart.updated event (the
        // shopper edits a quantity on the OTP screen) must not demote an
        // `otp` row back to `cart`.
        const rank: Record<string, number> = { cart: 0, checkout: 1, otp: 2, payment: 3 };
        const stage =
          (rank[input.stage] ?? 0) > (rank[existing.stage] ?? 0) ? input.stage : existing.stage;
        const mergedAddress = {
          ...((existing.address as Record<string, unknown> | null) ?? {}),
          ...typedAddress,
        };
        await this.prisma.client.incompleteOrder.update({
          where: { id: existing.id },
          data: {
            ...contact,
            ...(Object.keys(mergedAddress).length > 0
              ? { address: mergedAddress as Prisma.InputJsonValue }
              : {}),
            stage,
            cart: snapshot as unknown as Prisma.InputJsonValue,
            subtotal,
            lastSeenAt: new Date(),
          },
        });
        return;
      }

      const created = await this.prisma.client.incompleteOrder.create({
        data: {
          cartId: cart.id,
          customerId: cart.customerId,
          ...contact,
          ...(Object.keys(typedAddress).length > 0
            ? { address: typedAddress as Prisma.InputJsonValue }
            : {}),
          cart: snapshot as unknown as Prisma.InputJsonValue,
          subtotal,
          stage: input.stage,
        },
      });
      await this.campaigns.enqueueForIncomplete(created.id);
    } catch (err) {
      // Never let recovery bookkeeping break a checkout. A shopper pressing
      // Place Order must not see an error because an analytics row failed.
      this.logger.error(
        `captureCheckoutStage(${input.stage}) failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Best-effort match: a completed order's shipping phone or the logged-in
  // customerId against an outstanding IncompleteOrder — exact for
  // logged-in customers, phone-based for guests (no other link exists
  // between a guest cart and a guest checkout).
  @OnEvent(ORDER_CREATED_EVENT)
  async onOrderCreated(event: OrderCreatedEvent): Promise<void> {
    const order = await this.prisma.client.order.findUnique({
      where: { id: event.orderId },
      include: { addresses: { where: { type: 'SHIPPING' }, take: 1 } },
    });
    if (!order) return;
    const phone = order.addresses[0]?.phone;

    const where: Prisma.IncompleteOrderWhereInput = {
      recovered: false,
      // A cancelled cart stays cancelled. Staff already decided its outcome,
      // and silently relabelling it "recovered" would overwrite the reason
      // they recorded.
      canceledAt: null,
      OR: [
        event.customerId ? { customerId: event.customerId } : undefined,
        // Every stored representation, not a bare equality. This DB holds
        // three live formats for one real number (see phoneLookupCandidates)
        // and the order's phone is normalized while older abandonment rows
        // may not be — an exact match therefore found nothing, which is why
        // customers who completed checkout stayed in the abandonment list.
        phone ? { phone: { in: phoneLookupCandidates(phone) } } : undefined,
      ].filter((c): c is NonNullable<typeof c> => c !== undefined),
    };

    // updateMany, not "the newest one": the complaint this fixes is that a
    // customer who bought was still being chased, and clearing only the most
    // recent row leaves every earlier one doing exactly that. Someone who
    // buys has been recovered — that is what the metric is supposed to mean.
    const candidates = await this.prisma.client.incompleteOrder.findMany({
      where,
      select: { id: true },
    });
    if (candidates.length === 0) return;

    await this.prisma.client.incompleteOrder.updateMany({
      where: { id: { in: candidates.map((c) => c.id) } },
      data: { recovered: true, recoveredOrderId: order.id },
    });
    // ADDENDUM §C2 stop condition — a recovered order cancels the rest of
    // that cart's scheduled campaign steps.
    for (const c of candidates) {
      await this.campaigns.skipRemaining(c.id);
    }
  }

  async list(page: number, pageSize: number, filters: RecoveryListFilters = {}): Promise<PaginatedResult<IncompleteOrderDto>> {
    const where = await this.buildWhere(filters);
    const [items, total] = await Promise.all([
      this.prisma.client.incompleteOrder.findMany({ where, orderBy: { lastSeenAt: 'desc' }, ...paginationArgs(page, pageSize) }),
      this.prisma.client.incompleteOrder.count({ where }),
    ]);
    return toPaginatedResult(items.map(toIncompleteOrderDto), total, page, pageSize);
  }

  // IncompleteOrder.customerId has no Prisma relation to Customer (a raw
  // FK-shaped int, matching the model's own comment about it being a soft
  // reference) — so a name search needs its own lookup rather than a
  // relation filter, folded into the same OR as the phone/email match.
  private async buildWhere(filters: RecoveryListFilters): Promise<Prisma.IncompleteOrderWhereInput> {
    const where: Prisma.IncompleteOrderWhereInput = {
      // An abandoned cart with no name, phone or email cannot be recovered by
      // anyone -- there is nobody to contact. Those rows are still CAPTURED
      // (a guest may identify themselves later at checkout, and the details
      // land on this same row), they are just not listed as work to do.
      //
      // In AND, not as a bare OR: the `q` search below assigns `where.OR`
      // outright, which would silently drop this requirement exactly when a
      // search is active.
      AND: [
        {
          OR: [
            { name: { not: null } },
            { phone: { not: null } },
            { email: { not: null } },
          ],
        },
      ],
    };
    if (filters.outcome && filters.outcome !== 'all') {
      if (filters.outcome === 'open') {
        where.recovered = false;
        where.canceledAt = null;
      } else if (filters.outcome === 'recovered') {
        where.recovered = true;
      } else {
        where.canceledAt = { not: null };
      }
    } else if (!filters.outcome && filters.recovered !== undefined) {
      where.recovered = filters.recovered;
    }
    if (filters.stage) where.stage = filters.stage;
    if (filters.from || filters.to) {
      where.lastSeenAt = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      };
    }
    if (filters.q) {
      const q = filters.q.trim();
      const matchingCustomers = await this.prisma.client.customer.findMany({
        where: { OR: [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }] },
        select: { id: true },
      });
      where.OR = [
        ...phoneLookupCandidates(q).map((c) => ({ phone: { contains: c, mode: 'insensitive' as const } })),
        { email: { contains: q, mode: 'insensitive' as const } },
        // The name typed at checkout, which for a guest is the only name
        // there is -- the customer-table lookup above cannot find them.
        { name: { contains: q, mode: 'insensitive' as const } },
        ...(matchingCustomers.length > 0 ? [{ customerId: { in: matchingCustomers.map((c) => c.id) } }] : []),
      ];
    }
    return where;
  }

  async delete(id: number): Promise<void> {
    await this.prisma.client.incompleteOrder.delete({ where: { id } });
  }

  // Only clears unrecovered rows — a recovered row is a real conversion
  // record (links to a real order), not abandonment noise to bulk-delete.
  async clearAll(filters: RecoveryListFilters = {}): Promise<number> {
    // Never deletes a recovered OR a cancelled cart. Recovered rows are the
    // record that the funnel worked; cancelled rows carry the reason someone
    // typed, which is the entire point of cancelling a cart rather than
    // deleting it — a bulk "clear" that quietly destroyed those reasons would
    // undo the feature.
    const where = { ...(await this.buildWhere(filters)), recovered: false, canceledAt: null };
    const result = await this.prisma.client.incompleteOrder.deleteMany({ where });
    return result.count;
  }

  async exportCsv(filters: RecoveryListFilters = {}): Promise<string> {
    const rows = await this.prisma.client.incompleteOrder.findMany({
      where: await this.buildWhere(filters),
      orderBy: { lastSeenAt: 'desc' },
    });
    const header = [
      'id',
      'name',
      'phone',
      'email',
      // What they were actually going to buy. Without it the export says
      // someone abandoned 1,250 taka and nothing about of what, which is the
      // one thing that makes the row actionable.
      'products',
      'subtotal',
      'stage',
      'recovered',
      'canceled',
      'cancelReason',
      'recoveryAttempts',
      'lastSeenAt',
      'createdAt',
    ];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push(
        [
          r.id,
          r.name ?? '',
          r.phone ?? '',
          r.email ?? '',
          formatCartProducts(r.cart),
          r.subtotal.toString(),
          r.stage,
          r.recovered,
          r.canceledAt ? 'true' : 'false',
          r.cancelReason ?? '',
          r.recoveryAttempts,
          r.lastSeenAt.toISOString(),
          r.createdAt.toISOString(),
        ]
          .map(csvField)
          .join(','),
      );
    }
    return lines.join('\n');
  }

  // Columns: phone,email,subtotal — recreates bare incomplete-order rows
  // (no cart items, since a CSV can't carry a real product catalog
  // reference reliably) for merging abandonment data from another system.
  async importCsv(csvText: string): Promise<{ imported: number; skipped: number }> {
    const rows = parseCsv(csvText);
    let imported = 0;
    let skipped = 0;
    for (const row of rows) {
      const [phone, email, subtotalRaw] = row;
      if (phone?.toLowerCase() === 'phone') continue; // header row
      if (!phone && !email) {
        skipped++;
        continue;
      }
      const subtotal = Number(subtotalRaw) || 0;
      await this.prisma.client.incompleteOrder.create({
        data: { phone: phone || undefined, email: email || undefined, cart: [], subtotal, stage: 'cart' },
      });
      imported++;
    }
    return { imported, skipped };
  }

  // Admin "create real order from this abandoned cart" (Recovery/Cart
  // Abandonment parity) — recreates a real order from the stored cart
  // snapshot using each product's *current* price (the snapshot's price is
  // historical, matching the plugin's own simplicity here: no coupon/
  // discount replay, no fraud/blocker/OTP gates — this is a staff action on
  // behalf of a customer who already tried to buy, not a live checkout).
  /** JSON-sourced money, or null when it is not a usable number. */
  private parseDecimal(raw: unknown): Prisma.Decimal | null {
    if (typeof raw !== 'string' && typeof raw !== 'number') return null;
    try {
      const d = new Prisma.Decimal(raw);
      return d.isFinite() && d.greaterThanOrEqualTo(0) ? d : null;
    } catch {
      return null;
    }
  }

  async createOrderFromIncomplete(id: number, dto: CheckoutAddressDto): Promise<{ orderId: number; orderNumber: string }> {
    const incomplete = await this.prisma.client.incompleteOrder.findUniqueOrThrow({ where: { id } });
    if (incomplete.recovered) throw new Error('This cart has already been recovered');

    const snapshot = (incomplete.cart as unknown as CartSnapshotItem[]) ?? [];
    if (snapshot.length === 0) throw new Error('This cart has no items to recreate');

    const productIds = snapshot.map((i) => i.productId);
    const products = await this.prisma.client.product.findMany({
      where: { id: { in: productIds } },
      // Variants carry their own price: a `hasVariants` product has NULL
      // price/salePrice on the Product row itself (see the schema note), so
      // pricing from Product alone yields zero for every such item.
      include: { variants: { select: { id: true, price: true, salePrice: true } } },
    });
    const productById = new Map(products.map((p) => [p.id, p]));

    const items = snapshot.map((i) => {
      const product = productById.get(i.productId);
      const variant = i.variantId
        ? product?.variants.find((v) => v.id === i.variantId)
        : undefined;

      // The SNAPSHOT price wins. It is what the shopper was actually being
      // charged when they walked away, which is the whole point of recreating
      // their cart — and it is the only source that is right for a variant
      // product, whose Product row holds no price at all.
      //
      // This was the bug: pricing came from `p.salePrice ?? p.price ?? 0`, so
      // every variant product came back as 0 taka in Order Manager. The
      // intended `?? snapshot.unitPrice` fallback never fired either, because
      // the map DID hold that product id — with a value of zero.
      //
      // Parsed rather than trusted blindly (it is JSON), and 0 is a legitimate
      // value (a free ebook), so only a genuinely unparseable price falls
      // through to the live one.
      const snapshotPrice = this.parseDecimal(i.unitPrice);
      const unitPrice =
        snapshotPrice ??
        variant?.salePrice ??
        variant?.price ??
        product?.salePrice ??
        product?.price ??
        new Prisma.Decimal(0);

      return {
        productId: i.productId,
        variantId: variant?.id ?? null,
        quantity: i.quantity,
        unitPrice,
        name: i.name,
        // Reused from the same load, so a staff-recreated digital order still
        // snapshots DIGITAL and doesn't land in the courier dispatch queue.
        productType: product?.productType ?? 'PHYSICAL',
      };
    });
    const subTotal = items.reduce((sum, i) => sum.plus(i.unitPrice.times(i.quantity)), new Prisma.Decimal(0));

    const order = await this.prisma.client.order.create({
      data: {
        orderNumber: `REC-${Date.now().toString(36).toUpperCase()}`,
        customerId: incomplete.customerId,
        subTotal,
        totalAmount: subTotal,
        customerNote: 'Recreated from an abandoned cart by staff.',
        items: {
          create: items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            productNameSnapshot: i.name,
            unitPrice: i.unitPrice,
            quantity: i.quantity,
            productTypeSnapshot: i.productType,
          })),
        },
        addresses: {
          create: [
            toOrderAddressCreate(dto, 'SHIPPING'),
            toOrderAddressCreate(dto, 'BILLING'),
          ],
        },
        statusHistory: { create: { status: 'PENDING', note: 'Order recreated from abandoned cart' } },
        payments: { create: { provider: 'COD', status: 'PENDING', amount: subTotal } },
      },
    });

    await this.prisma.client.incompleteOrder.update({
      where: { id },
      data: { recovered: true, recoveredOrderId: order.id },
    });
    await this.campaigns.skipRemaining(id);

    // Same gap as AdminOrderCreationService — the snapshot carries
    // productTypeSnapshot: 'DIGITAL' for any digital line, but this order was
    // built with a raw tx.order.create rather than checkout(), so nothing
    // else creates the locked entitlement. Without this, a staff-recreated
    // ebook order pays fine and unlockForOrder later just matches zero rows.
    await this.downloads.createForOrder(order.id);

    return { orderId: order.id, orderNumber: order.orderNumber };
  }

  /**
   * Staff giving up on a cart, with the reason recorded.
   *
   * Deliberately not a delete: the reason is the point — it is what turns a
   * pile of dead carts into something you can read a pattern out of ("price",
   * "duplicate order", "customer unreachable"). Deleting the row throws that
   * away along with the cart itself.
   *
   * Stops any queued win-back messages, for the same reason recovering does:
   * continuing to SMS someone whose cart staff have explicitly written off is
   * the worst of both worlds.
   */
  async cancel(id: number, reason: string): Promise<IncompleteOrderDto> {
    const existing = await this.prisma.client.incompleteOrder.findUniqueOrThrow({ where: { id } });
    if (existing.recovered) {
      throw new BadRequestException('This cart was already recovered, so there is nothing to cancel');
    }
    const trimmed = reason.trim();
    if (!trimmed) throw new BadRequestException('A cancellation reason is required');

    const row = await this.prisma.client.incompleteOrder.update({
      where: { id },
      data: { canceledAt: new Date(), cancelReason: trimmed },
    });
    await this.campaigns.skipRemaining(id);
    return toIncompleteOrderDto(row);
  }

  async recoveryRate(): Promise<{ total: number; recovered: number; ratePercent: number; recoveredValue: string }> {
    const [total, recoveredRows] = await Promise.all([
      this.prisma.client.incompleteOrder.count(),
      this.prisma.client.incompleteOrder.findMany({ where: { recovered: true }, select: { subtotal: true } }),
    ]);
    const recoveredValue = recoveredRows.reduce((sum, r) => sum.plus(r.subtotal), new Prisma.Decimal(0));
    return {
      total,
      recovered: recoveredRows.length,
      ratePercent: total > 0 ? Number(((recoveredRows.length / total) * 100).toFixed(1)) : 0,
      recoveredValue: recoveredValue.toString(),
    };
  }

  async sendRecovery(id: number): Promise<void> {
    const row = await this.prisma.client.incompleteOrder.findUniqueOrThrow({ where: { id } });
    if (!row.phone) {
      this.logger.warn(`IncompleteOrder #${id} has no phone — cannot send recovery SMS`);
      return;
    }

    const template = await this.prisma.client.smsTemplate.findUnique({ where: { key: 'recovery' } });
    if (!template || !template.enabled) return;

    const body = await this.mergeTags.render(template.bodyEn, {
      customerId: row.customerId,
      phone: row.phone,
      email: row.email,
      amount: row.subtotal.toString(),
      cart: (row.cart as unknown as CartSnapshotItem[]) ?? [],
    });
    await this.sms.send(row.phone, body, 'recovery');
    await this.prisma.client.incompleteOrder.update({
      where: { id },
      data: { recoveryAttempts: { increment: 1 } },
    });
  }

  // Hourly sweep — finds rows stale past `delayHours` with attempts left,
  // skips outside the configured quiet-hours window (checked against
  // server-local time; deferred to the next hourly tick, not dropped).
  @Cron(CronExpression.EVERY_HOUR)
  async sweep(): Promise<void> {
    const settings = await this.getSettings();
    if (!settings.enabled) return;

    const hour = new Date().getHours();
    const inQuietHours =
      settings.quietHoursStart < settings.quietHoursEnd
        ? hour >= settings.quietHoursStart && hour < settings.quietHoursEnd
        : hour >= settings.quietHoursStart || hour < settings.quietHoursEnd;
    if (inQuietHours) return;

    const cutoff = new Date(Date.now() - settings.delayHours * 60 * 60 * 1000);
    const stale = await this.prisma.client.incompleteOrder.findMany({
      where: {
        recovered: false,
        phone: { not: null },
        lastSeenAt: { lt: cutoff },
        recoveryAttempts: { lt: settings.maxAttempts },
      },
    });

    for (const row of stale) {
      await this.sendRecovery(row.id);
    }
    if (stale.length > 0) this.logger.log(`Recovery sweep sent ${stale.length} SMS`);
  }
}
