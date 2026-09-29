import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';
import { POS_SALE_COMPLETED_EVENT } from './pos-sale.service';
import { PosSmsCampaign, PosSmsCampaignType, Prisma } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SmsService } from '../net-profit/sms/sms.service';
import { PosTiersService } from './pos-tiers.service';
import { type PosTier, nextRun, renderSms, tierFor, tierRank } from './pos-tiers';

const SETTINGS_KEY = 'pos.sms';

export interface PosSmsSettings {
  /** Text the customer after every POS sale with a phone number. */
  thankYouEnabled: boolean;
  thankYouMessage: string;
  websiteUrl: string;
}

export const POS_SMS_DEFAULTS: PosSmsSettings = {
  thankYouEnabled: true,
  thankYouMessage:
    'Thank you for shopping at {{store}}, {{name}}! Your total is ৳{{amount}} (order {{orderNumber}}). Shop online: {{website}}',
  websiteUrl: 'https://amadere.com',
};

export interface CampaignInput {
  name: string;
  storeId?: number | null;
  tierKey?: string | null;
  type: PosSmsCampaignType;
  message: string;
  sendAt?: string | null;
  repeat?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | null;
  winbackDays?: number | null;
  active?: boolean;
}

interface Recipient {
  customerId: number;
  phone: string;
  name: string;
  storeName: string;
  tier: PosTier | null;
}

const DAY = 86_400_000;

/**
 * POS SMS: the thank-you text after a sale, and Customer Manager campaigns
 * (send now, scheduled/recurring, tier upgrade, win-back). Everything goes
 * through the website's SMS gateway (SmsService), so it shares its settings
 * and every message is in the SMS log.
 */
@Injectable()
export class PosSmsService {
  private readonly logger = new Logger(PosSmsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly tiers: PosTiersService,
  ) {}

  // ---------- settings ----------
  async getSettings(): Promise<PosSmsSettings> {
    const row = await this.prisma.client.setting.findUnique({ where: { key: SETTINGS_KEY } });
    return { ...POS_SMS_DEFAULTS, ...((row?.value as Partial<PosSmsSettings>) ?? {}) };
  }

  async setSettings(v: PosSmsSettings): Promise<PosSmsSettings> {
    const value = {
      thankYouEnabled: !!v.thankYouEnabled,
      thankYouMessage: String(v.thankYouMessage ?? '').trim() || POS_SMS_DEFAULTS.thankYouMessage,
      websiteUrl: String(v.websiteUrl ?? '').trim(),
    };
    await this.prisma.client.setting.upsert({
      where: { key: SETTINGS_KEY },
      create: { key: SETTINGS_KEY, value },
      update: { value },
    });
    return value;
  }

  /** What POS Settings › SMS shows about the shared gateway. */
  async gateway() {
    const s = await this.sms.getSettings();
    return {
      enabled: s.enabled,
      senderId: s.senderId,
      hasApiKey: s.hasApiKey,
      balance: s.enabled ? await this.sms.getBalance().catch(() => null) : null,
    };
  }

  async testSend(phone: string) {
    const s = await this.getSettings();
    const body = renderSms(s.thankYouMessage, {
      name: 'Karim',
      amount: '360.00',
      orderNumber: 'ORD-TEST',
      store: 'Your store',
      website: s.websiteUrl,
    });
    return this.sms.send(phone, body, 'pos_thank_you_test');
  }

  // ---------- after a sale ----------
  /** Thank-you text + tier-upgrade campaigns. Best-effort: never fails a sale. */
  @OnEvent(POS_SALE_COMPLETED_EVENT, { async: true })
  async onSale(e: { orderId: number }): Promise<void> {
    await this.afterSale(e.orderId);
  }

  async afterSale(orderId: number): Promise<void> {
    try {
      const o = await this.prisma.client.order.findUnique({
        where: { id: orderId },
        select: {
          orderNumber: true,
          totalAmount: true,
          storeId: true,
          customerId: true,
          store: { select: { name: true } },
          customer: { select: { firstName: true, lastName: true, phone: true } },
        },
      });
      const phone = o?.customer?.phone;
      if (!o || !phone || !o.storeId || !o.customerId) return;
      const gw = await this.sms.getSettings();
      if (!gw.enabled) return;
      const name = displayName(o.customer!);
      const settings = await this.getSettings();
      if (settings.thankYouEnabled)
        await this.sms.send(
          phone,
          renderSms(settings.thankYouMessage, {
            name,
            amount: o.totalAmount.toFixed(2),
            orderNumber: o.orderNumber,
            store: o.store?.name,
            website: settings.websiteUrl,
          }),
          'pos_thank_you',
        );

      // Tier upgrade: compare the tier at this store before and after this sale.
      const tiers = await this.tiers.getTiers();
      const [now] = await this.tiers.stats({ storeId: o.storeId, customerIds: [o.customerId] });
      if (!now) return;
      const after = tierFor(now, tiers);
      const before = tierFor(
        { orders: now.orders - 1, spent: now.spent - Number(o.totalAmount) },
        tiers,
      );
      if (!after || tierRank(after, tiers) <= tierRank(before, tiers)) return;
      const campaigns = await this.prisma.client.posSmsCampaign.findMany({
        where: {
          active: true,
          type: 'TIER_UPGRADE',
          OR: [{ storeId: null }, { storeId: o.storeId }],
          AND: [{ OR: [{ tierKey: null }, { tierKey: after.key }] }],
        },
      });
      for (const c of campaigns)
        await this.deliverOnce(c, {
          customerId: o.customerId,
          phone,
          name,
          storeName: o.store?.name ?? '',
          tier: after,
        }, `up:${o.storeId}:${after.key}`);
    } catch (e) {
      this.logger.warn(`POS SMS after sale ${orderId} failed: ${(e as Error).message}`);
    }
  }

  // ---------- campaigns ----------
  list(storeId: number | null) {
    return this.prisma.client.posSmsCampaign.findMany({
      where: storeId ? { storeId } : {},
      orderBy: { createdAt: 'desc' },
      include: { store: { select: { name: true } } },
    });
  }

  private validate(dto: CampaignInput): Prisma.PosSmsCampaignUncheckedCreateInput {
    const name = dto.name?.trim();
    const message = dto.message?.trim();
    if (!name) throw new BadRequestException('Give the campaign a name');
    if (!message) throw new BadRequestException('Write the message');
    const base = {
      name,
      message,
      storeId: dto.storeId ?? null,
      tierKey: dto.tierKey || null,
      type: dto.type,
      active: dto.active ?? true,
      sendAt: null as Date | null,
      nextRunAt: null as Date | null,
      repeat: null as string | null,
      winbackDays: null as number | null,
    };
    if (dto.type === 'SCHEDULED' || dto.type === 'RECURRING') {
      const at = dto.sendAt ? new Date(dto.sendAt) : null;
      if (!at || isNaN(at.getTime())) throw new BadRequestException('Pick the date and time');
      base.sendAt = at;
      base.nextRunAt = at;
      if (dto.type === 'RECURRING') {
        if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(dto.repeat ?? ''))
          throw new BadRequestException('Pick how often it repeats');
        base.repeat = dto.repeat!;
      }
    }
    if (dto.type === 'WINBACK') {
      const d = Math.floor(Number(dto.winbackDays));
      if (!(d >= 1)) throw new BadRequestException('Win-back needs a number of days (1 or more)');
      base.winbackDays = d;
    }
    return base;
  }

  async create(dto: CampaignInput, adminId: number) {
    const data = this.validate(dto);
    if (dto.type === 'NOW' && !(await this.sms.getSettings()).enabled)
      throw new BadRequestException('SMS gateway is off — turn it on in Net Profit › SMS');
    const c = await this.prisma.client.posSmsCampaign.create({
      data: { ...data, createdById: adminId, active: dto.type === 'NOW' ? false : data.active },
    });
    if (dto.type === 'NOW') return { ...c, ...(await this.run(c)) };
    return c;
  }

  async update(id: number, dto: CampaignInput) {
    const data = this.validate(dto);
    return this.prisma.client.posSmsCampaign.update({ where: { id }, data });
  }

  remove(id: number) {
    return this.prisma.client.posSmsCampaign.delete({ where: { id } });
  }

  /** How many customers a campaign would reach right now. */
  async previewCount(dto: Pick<CampaignInput, 'storeId' | 'tierKey' | 'type' | 'winbackDays'>) {
    const list =
      dto.type === 'WINBACK'
        ? await this.winbackAudience({ storeId: dto.storeId ?? null, tierKey: dto.tierKey ?? null, winbackDays: dto.winbackDays ?? 30 })
        : await this.audience(dto.storeId ?? null, dto.tierKey ?? null);
    return { count: list.length };
  }

  /** "Send now" for a saved campaign (any type sends to its current audience). */
  async sendNow(id: number) {
    const c = await this.prisma.client.posSmsCampaign.findUniqueOrThrow({ where: { id } });
    return this.run(c);
  }

  // ---------- audience ----------
  /** Customers with a phone who bought at the store (or any store), optionally in one tier there. */
  async audience(storeId: number | null, tierKey: string | null): Promise<Recipient[]> {
    const [tiers, stats] = await Promise.all([this.tiers.getTiers(), this.tiers.stats({ storeId })]);
    return this.toRecipients(stats, tiers, tierKey);
  }

  private async winbackAudience(c: { storeId: number | null; tierKey: string | null; winbackDays: number | null }) {
    const [tiers, stats] = await Promise.all([this.tiers.getTiers(), this.tiers.stats({ storeId: c.storeId })]);
    const cutoff = Date.now() - (c.winbackDays ?? 30) * DAY;
    // Per customer, their LAST purchase anywhere in scope must be older than the cutoff.
    const last = new Map<number, number>();
    for (const s of stats) last.set(s.customerId, Math.max(last.get(s.customerId) ?? 0, s.last.getTime()));
    return this.toRecipients(stats.filter((s) => (last.get(s.customerId) ?? 0) < cutoff), tiers, c.tierKey);
  }

  private async toRecipients(
    stats: Awaited<ReturnType<PosTiersService['stats']>>,
    tiers: PosTier[],
    tierKey: string | null,
  ): Promise<Recipient[]> {
    const picked = new Map<number, { storeId: number; tier: PosTier | null }>();
    for (const s of stats) {
      const tier = tierFor(s, tiers);
      if (tierKey && tier?.key !== tierKey) continue;
      // One text per customer; keep the store where they rank highest.
      const cur = picked.get(s.customerId);
      if (!cur || tierRank(tier, tiers) > tierRank(cur.tier, tiers))
        picked.set(s.customerId, { storeId: s.storeId, tier });
    }
    if (!picked.size) return [];
    const [people, stores] = await Promise.all([
      this.prisma.client.customer.findMany({
        where: { id: { in: [...picked.keys()] }, deletedAt: null, phone: { not: null } },
        select: { id: true, firstName: true, lastName: true, phone: true },
      }),
      this.prisma.client.store.findMany({ select: { id: true, name: true } }),
    ]);
    const storeName = new Map(stores.map((s) => [s.id, s.name]));
    return people.map((p) => {
      const pick = picked.get(p.id)!;
      return {
        customerId: p.id,
        phone: p.phone!,
        name: displayName(p),
        storeName: storeName.get(pick.storeId) ?? '',
        tier: pick.tier,
      };
    });
  }

  // ---------- sending ----------
  private async sendTo(c: PosSmsCampaign, r: Recipient) {
    const settings = await this.getSettings();
    await this.sms.send(
      r.phone,
      renderSms(c.message, {
        name: r.name,
        store: r.storeName,
        tier: r.tier?.name ?? '',
        website: settings.websiteUrl,
      }),
      `pos_campaign:${c.id}`,
    );
  }

  /** Sends once per (campaign, customer, key); false if already sent. */
  private async deliverOnce(c: PosSmsCampaign, r: Recipient, key: string) {
    try {
      await this.prisma.client.posSmsDelivery.create({
        data: { campaignId: c.id, customerId: r.customerId, key },
      });
    } catch {
      return false; // unique (campaign, customer, key): already sent
    }
    await this.sendTo(c, r);
    await this.prisma.client.posSmsCampaign.update({
      where: { id: c.id },
      data: { sentCount: { increment: 1 }, lastRunAt: new Date() },
    });
    return true;
  }

  /** One run to the campaign's current audience. */
  private async run(c: PosSmsCampaign) {
    const gw = await this.sms.getSettings();
    if (!gw.enabled)
      throw new BadRequestException('SMS gateway is off — turn it on in Net Profit › SMS');
    if (c.type === 'WINBACK') {
      let sent = 0;
      for (const r of await this.winbackAudience(c)) {
        const last = await this.lastOrderId(r.customerId, c.storeId);
        if (await this.deliverOnce(c, r, `wb:${last}`)) sent++;
      }
      return { sent };
    }
    const list = await this.audience(c.storeId, c.tierKey);
    // ponytail: sequential sends inside the request/cron tick, like
    // SmsService.bulkSend; queue it if audiences reach thousands.
    for (const r of list) await this.sendTo(c, r);
    await this.prisma.client.posSmsCampaign.update({
      where: { id: c.id },
      data: { sentCount: { increment: list.length }, lastRunAt: new Date() },
    });
    return { sent: list.length };
  }

  private async lastOrderId(customerId: number, storeId: number | null) {
    const o = await this.prisma.client.order.findFirst({
      where: { channel: 'POS', status: { in: ['COMPLETED', 'PARTIALLY_RETURNED'] }, deletedAt: null, customerId, ...(storeId ? { storeId } : {}) },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    return o?.id ?? 0;
  }

  /** Scheduled and recurring campaigns that are due. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async runDue(now = new Date()) {
    const due = await this.prisma.client.posSmsCampaign.findMany({
      where: { active: true, type: { in: ['SCHEDULED', 'RECURRING'] }, nextRunAt: { lte: now } },
    });
    for (const c of due) {
      // Move the schedule on first, so a failing gateway can't resend every tick.
      await this.prisma.client.posSmsCampaign.update({
        where: { id: c.id },
        data:
          c.type === 'RECURRING'
            ? { nextRunAt: advance(c.nextRunAt!, c.repeat!, now) }
            : { active: false, nextRunAt: null },
      });
      await this.run(c).catch((e) => this.logger.warn(`Campaign ${c.id}: ${(e as Error).message}`));
    }
    return { ran: due.length };
  }

  /** Win-back campaigns, once a day at 11:00 Dhaka. */
  @Cron('0 0 11 * * *', { timeZone: 'Asia/Dhaka' })
  async runWinbacks() {
    const list = await this.prisma.client.posSmsCampaign.findMany({ where: { active: true, type: 'WINBACK' } });
    for (const c of list)
      await this.run(c).catch((e) => this.logger.warn(`Win-back ${c.id}: ${(e as Error).message}`));
    return { ran: list.length };
  }
}

/** Next run strictly after `now` (skips missed runs instead of sending them all). */
function advance(from: Date, repeat: string, now: Date): Date {
  let d = nextRun(from, repeat);
  while (d <= now) d = nextRun(d, repeat);
  return d;
}

function displayName(c: { firstName: string | null; lastName: string | null }) {
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Customer';
}
