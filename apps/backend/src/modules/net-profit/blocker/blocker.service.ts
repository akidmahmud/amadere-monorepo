import { ConflictException, Injectable } from '@nestjs/common';
import { BlockType } from '@amader/db';
import { normalizeBdPhone } from '@amader/shared';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NetProfitSettingsService } from '../settings/net-profit-settings.service';
import { CreateBlockRuleDto } from './dto/create-block-rule.dto';
import { BlockRuleDto, toBlockRuleDto } from './blocker.mapper';

export interface BlockCheckInput {
  phone?: string;
  email?: string;
  ip?: string;
  deviceId?: string;
}

export interface BlockerSettings {
  autoBlockOnFraud: boolean;
}

const BLOCKER_SETTINGS_DEFAULTS: BlockerSettings = { autoBlockOnFraud: false };

@Injectable()
export class BlockerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: NetProfitSettingsService,
  ) {}

  async list(): Promise<BlockRuleDto[]> {
    const rows = await this.prisma.client.blockRule.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map(toBlockRuleDto);
  }

  async create(dto: CreateBlockRuleDto, createdBy?: number): Promise<BlockRuleDto> {
    const value = dto.type === 'PHONE' ? (normalizeBdPhone(dto.value) ?? dto.value) : dto.value;
    const existing = await this.prisma.client.blockRule.findUnique({
      where: { type_value: { type: dto.type, value } },
    });
    if (existing) throw new ConflictException('This rule already exists');
    const row = await this.prisma.client.blockRule.create({
      data: {
        type: dto.type,
        value,
        category: dto.category,
        customerName: dto.customerName,
        addressText: dto.addressText,
        reason: dto.reason,
        note: dto.note,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        createdBy,
      },
    });
    return toBlockRuleDto(row);
  }

  // ADDENDUM §E — rules the fraud gate creates itself (source=AUTO) rather
  // than an admin typing them in. Same unique-constraint idempotency as a
  // manual create: re-triggering the same phone just updates the existing
  // row instead of erroring.
  async autoBlock(type: BlockType, rawValue: string, category: string, reason: string): Promise<BlockRuleDto> {
    const value = type === 'PHONE' ? (normalizeBdPhone(rawValue) ?? rawValue) : rawValue;
    const row = await this.prisma.client.blockRule.upsert({
      where: { type_value: { type, value } },
      create: { type, value, source: 'AUTO', category, reason },
      update: { source: 'AUTO', category, reason, isActive: true },
    });
    return toBlockRuleDto(row);
  }

  async getSettings(): Promise<BlockerSettings> {
    return this.settings.getNamespace('blocker', BLOCKER_SETTINGS_DEFAULTS);
  }

  async updateSettings(dto: Partial<BlockerSettings>): Promise<BlockerSettings> {
    await this.settings.setNamespace('blocker', dto);
    return this.getSettings();
  }

  // Called from the checkout fraud gate when a checkout is actually
  // rejected — self-checks `autoBlockOnFraud` (default off, same
  // fail-closed-by-default posture as every other Net Profit toggle) so
  // CheckoutService doesn't need to know this setting exists.
  async maybeAutoBlockFraud(phone: string): Promise<void> {
    const settings = await this.getSettings();
    if (!settings.autoBlockOnFraud) return;
    await this.autoBlock('PHONE', phone, 'fraud', 'Auto-blocked: checkout rejected by the fraud gate');
  }

  async setActive(id: number, isActive: boolean): Promise<BlockRuleDto> {
    const row = await this.prisma.client.blockRule.update({ where: { id }, data: { isActive } });
    return toBlockRuleDto(row);
  }

  async remove(id: number): Promise<void> {
    await this.prisma.client.blockRule.delete({ where: { id } });
  }

  // Checkout-side guard (§7.6, extended ADDENDUM §E) — phone, email, IP,
  // and device, checked for every payment method (not just COD). Only
  // active, unexpired rules block; an admin "inactive" toggle or an
  // expired timed block silently stops applying rather than needing
  // deletion.
  async check(input: BlockCheckInput): Promise<{ blocked: boolean; rule?: BlockRuleDto }> {
    const candidates: { type: BlockType; value: string }[] = [];
    if (input.phone) {
      const normalized = normalizeBdPhone(input.phone);
      if (normalized) candidates.push({ type: 'PHONE', value: normalized });
    }
    if (input.email) candidates.push({ type: 'EMAIL', value: input.email.toLowerCase() });
    if (input.ip) candidates.push({ type: 'IP', value: input.ip });
    if (input.deviceId) candidates.push({ type: 'DEVICE', value: input.deviceId });
    if (candidates.length === 0) return { blocked: false };

    const rule = await this.prisma.client.blockRule.findFirst({
      where: {
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        AND: { OR: candidates.map((c) => ({ type: c.type, value: c.value })) },
      },
    });
    return rule ? { blocked: true, rule: toBlockRuleDto(rule) } : { blocked: false };
  }

  // Cleanup cron (§G) — expired timed blocks are already inert in check()
  // via the expiresAt filter; this just prunes them so the list doesn't
  // grow unbounded with dead rows.
  async pruneExpired(): Promise<number> {
    const result = await this.prisma.client.blockRule.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }
}
