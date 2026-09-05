import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import webpush, { type PushSubscription as WebPushSubscription } from 'web-push';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CredentialsService } from '../../common/credentials/credentials.service';

export const VAPID_PUBLIC_KEY = 'push.vapid.publicKey';
export const VAPID_PRIVATE_KEY = 'push.vapid.privateKey';
export const VAPID_SUBJECT_KEY = 'push.vapid.subject';

/** Fallback when no subject is configured. Must be a mailto: or https: URL —
 *  push services reject anything else. */
const DEFAULT_SUBJECT = 'mailto:support@amadere.com';

export interface PushPayload {
  title: string;
  body: string;
  /** Where tapping the notification takes them. Relative to the storefront. */
  url?: string;
  icon?: string;
  /** Collapses replacing notifications — a second cart reminder for the same
   *  cart should replace the first, not stack. */
  tag?: string;
}

export interface PushSendResult {
  sent: number;
  failed: number;
  /** Endpoints the push service reported as gone — marked revoked, not deleted. */
  revoked: number;
}

/**
 * Browser push delivery.
 *
 * Deliberately thin: this class owns keys, encryption and the fate of a dead
 * subscription, and nothing else. WHO gets a message and WHEN is the campaign
 * engine's job (see CartCampaignsService), which already owns delay rules,
 * quiet hours, retries and logging for SMS and email — push is a third channel
 * on that queue, not a parallel system.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: CredentialsService,
    private readonly config: ConfigService,
  ) {}

  /** The half of the key pair the browser needs to subscribe. Public by
   *  definition — it is handed to every visitor. */
  async getPublicKey(): Promise<string | null> {
    return (
      (await this.credentials.getCredential(VAPID_PUBLIC_KEY)) ??
      this.config.get<string>('VAPID_PUBLIC_KEY') ??
      null
    );
  }

  private async getPrivateKey(): Promise<string | null> {
    return (
      (await this.credentials.getCredential(VAPID_PRIVATE_KEY)) ??
      this.config.get<string>('VAPID_PRIVATE_KEY') ??
      null
    );
  }

  async isConfigured(): Promise<boolean> {
    return Boolean((await this.getPublicKey()) && (await this.getPrivateKey()));
  }

  async saveKeys(input: { publicKey?: string; privateKey?: string; subject?: string }): Promise<void> {
    await this.credentials.saveCredential(VAPID_PUBLIC_KEY, input.publicKey?.trim());
    await this.credentials.saveCredential(VAPID_PRIVATE_KEY, input.privateKey?.trim());
    await this.credentials.saveCredential(VAPID_SUBJECT_KEY, input.subject?.trim());
  }

  /** Generate a fresh pair for the admin to save. Rotating invalidates every
   *  existing subscription, which is why this only returns them — saving is a
   *  separate, deliberate act. */
  generateKeys(): { publicKey: string; privateKey: string } {
    return webpush.generateVAPIDKeys();
  }

  /**
   * Record a browser's subscription.
   *
   * Upsert on endpoint: a browser that re-subscribes (permission re-granted,
   * key rotated, subscription refreshed by the OS) must update its row. An
   * insert would create a duplicate and deliver every notification twice.
   */
  async subscribe(input: {
    endpoint: string;
    p256dh: string;
    auth: string;
    customerId?: number | null;
    guestToken?: string | null;
    userAgent?: string | null;
    locale?: string;
  }): Promise<{ id: number }> {
    const row = await this.prisma.client.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        customerId: input.customerId ?? null,
        guestToken: input.guestToken ?? null,
        userAgent: input.userAgent?.slice(0, 400) ?? null,
        locale: input.locale ?? 'EN',
      },
      update: {
        p256dh: input.p256dh,
        auth: input.auth,
        // Only ever fills a blank — an anonymous opt-in gets claimed once the
        // visitor logs in, but a later anonymous visit on a shared device must
        // not detach the subscription from whoever owns it.
        ...(input.customerId ? { customerId: input.customerId } : {}),
        // Always refreshed: a browser's guest token rotates when its cart is
        // replaced, and a stale one points at a cart nobody will abandon.
        ...(input.guestToken ? { guestToken: input.guestToken } : {}),
        userAgent: input.userAgent?.slice(0, 400) ?? undefined,
        ...(input.locale ? { locale: input.locale } : {}),
        // Re-subscribing is how a browser comes back from revoked.
        revokedAt: null,
        lastSeenAt: new Date(),
      },
      select: { id: true },
    });
    return row;
  }

  async unsubscribe(endpoint: string): Promise<void> {
    await this.prisma.client.pushSubscription.updateMany({
      where: { endpoint },
      data: { revokedAt: new Date() },
    });
  }

  /** Live subscriptions for one customer, across every device they opted in on. */
  async subscriptionsForCustomer(customerId: number) {
    return this.prisma.client.pushSubscription.findMany({
      where: { customerId, revokedAt: null },
    });
  }

  async stats(): Promise<{ active: number; revoked: number; linkedToCustomer: number }> {
    const [active, revoked, linked] = await Promise.all([
      this.prisma.client.pushSubscription.count({ where: { revokedAt: null } }),
      this.prisma.client.pushSubscription.count({ where: { revokedAt: { not: null } } }),
      this.prisma.client.pushSubscription.count({
        where: { revokedAt: null, customerId: { not: null } },
      }),
    ]);
    return { active, revoked, linkedToCustomer: linked };
  }

  /**
   * Send to specific endpoints.
   *
   * A 404 or 410 from the push service is not an error to retry — it is the
   * service telling us this browser is gone for good (cleared data, uninstalled,
   * permission revoked). Those are marked revoked so the next send skips them;
   * anything else is a real failure and is reported as one.
   */
  async sendToEndpoints(
    subs: { endpoint: string; p256dh: string; auth: string }[],
    payload: PushPayload,
  ): Promise<PushSendResult> {
    if (subs.length === 0) return { sent: 0, failed: 0, revoked: 0 };

    const [publicKey, privateKey] = await Promise.all([this.getPublicKey(), this.getPrivateKey()]);
    if (!publicKey || !privateKey) {
      this.logger.warn('Push send skipped: VAPID keys are not configured');
      return { sent: 0, failed: subs.length, revoked: 0 };
    }
    const subject =
      (await this.credentials.getCredential(VAPID_SUBJECT_KEY)) ?? DEFAULT_SUBJECT;
    webpush.setVapidDetails(subject, publicKey, privateKey);

    const body = JSON.stringify(payload);
    const dead: string[] = [];
    let sent = 0;
    let failed = 0;

    await Promise.all(
      subs.map(async (s) => {
        const target: WebPushSubscription = {
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        };
        try {
          await webpush.sendNotification(target, body, { TTL: 60 * 60 * 24 });
          sent += 1;
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            dead.push(s.endpoint);
            return;
          }
          failed += 1;
          this.logger.warn(
            `Push send failed (${status ?? 'no status'}): ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }),
    );

    if (dead.length > 0) {
      await this.prisma.client.pushSubscription.updateMany({
        where: { endpoint: { in: dead } },
        data: { revokedAt: new Date() },
      });
    }
    return { sent, failed, revoked: dead.length };
  }

  /** Every device this customer has opted in on. */
  async sendToCustomer(customerId: number, payload: PushPayload): Promise<PushSendResult> {
    const subs = await this.subscriptionsForCustomer(customerId);
    return this.sendToEndpoints(subs, payload);
  }

  /**
   * Every browser attached to one abandoned cart.
   *
   * Matches on EITHER identity, because a cart can have both: `guestToken` is
   * how an anonymous shopper is reached (the common case — carts are filled
   * before anyone signs in), and `customerId` catches the same person's other
   * devices once they do sign in.
   */
  async sendToCart(
    cart: { guestToken?: string | null; customerId?: number | null },
    payload: PushPayload,
  ): Promise<PushSendResult> {
    const or: { guestToken?: string; customerId?: number }[] = [];
    if (cart.guestToken) or.push({ guestToken: cart.guestToken });
    if (cart.customerId) or.push({ customerId: cart.customerId });
    if (or.length === 0) return { sent: 0, failed: 0, revoked: 0 };

    const subs = await this.prisma.client.pushSubscription.findMany({
      where: { revokedAt: null, OR: or },
    });
    return this.sendToEndpoints(subs, payload);
  }

  /** One endpoint — used by the admin's "send a test" button. */
  async sendToOne(endpoint: string, payload: PushPayload): Promise<PushSendResult> {
    const sub = await this.prisma.client.pushSubscription.findUnique({ where: { endpoint } });
    if (!sub || sub.revokedAt) return { sent: 0, failed: 0, revoked: 0 };
    return this.sendToEndpoints([sub], payload);
  }
}
