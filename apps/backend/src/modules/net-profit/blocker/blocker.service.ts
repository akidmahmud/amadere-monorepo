import { ConflictException, Injectable } from '@nestjs/common';
import { BlockRule, BlockSource, BlockType, Prisma } from '@amader/db';
import { normalizeBdPhone } from '@amader/shared';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { FraudService } from '../fraud/fraud.service';
import { NetProfitSettingsService } from '../settings/net-profit-settings.service';
import { CreateBlockRuleDto } from './dto/create-block-rule.dto';
import { BlockRuleDto, BlockRuleStatus, ruleStatus, toBlockRuleDto } from './blocker.mapper';
import { BlockerRulesService, BlockCheckoutContext } from './blocker-rules.service';
import { BLOCKER_SETTINGS_DEFAULTS, BlockerSettings, RULE_LABELS } from './blocker-settings.types';

export interface BlockCheckInput {
  phone?: string;
  email?: string;
  ip?: string;
  deviceId?: string;
  name?: string;
  address?: string;
}

export interface CheckoutBlockResult {
  blocked: boolean;
  heading?: string;
  sub?: string;
  reason?: string;
  showReason?: boolean;
  contacts?: {
    call?: string;
    whatsapp?: string;
    email?: string;
  };
}

export interface ListEntriesArgs {
  source?: 'MANUAL' | 'AUTO';
  status?: BlockRuleStatus;
  q?: string;
  page?: number;
  pageSize?: number;
}

const ADDRESS_TYPES: BlockType[] = ['ADDRESS'];

function normalizeMatchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function addressVariants(address: string): string[] {
  const normalized = normalizeMatchText(address);
  if (!normalized) return [];
  const variants = new Set<string>([normalized]);
  for (const part of normalized.split(' ')) {
    if (part.length >= 3) variants.add(part);
  }
  return [...variants];
}

@Injectable()
export class BlockerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: NetProfitSettingsService,
    private readonly rules: BlockerRulesService,
    private readonly fraud: FraudService,
  ) {}

  async list(args: ListEntriesArgs = {}): Promise<{ items: BlockRuleDto[]; total: number }> {
    const page = Math.max(1, args.page ?? 1);
    const pageSize = Math.max(1, Math.min(200, args.pageSize ?? 30));
    const where: Prisma.BlockRuleWhereInput = {};
    if (args.source) where.source = args.source;
    if (args.q) {
      const q = args.q.trim();
      where.OR = [
        { value: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
        { addressText: { contains: q, mode: 'insensitive' } },
        { reason: { contains: q, mode: 'insensitive' } },
        { note: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (args.status === 'unblocked') where.isActive = false;
    else if (args.status === 'active') where.isActive = true;
    else if (args.status === 'expired') where.expiresAt = { lt: new Date() };

    const [rows, total] = await Promise.all([
      this.prisma.client.blockRule.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.client.blockRule.count({ where }),
    ]);

    let items = rows.map(toBlockRuleDto);
    // "expired" filtering above already narrows via expiresAt; "active" here
    // also needs the not-yet-expired condition, applied post-query since it's
    // a derived status rather than a stored column.
    if (args.status === 'active') items = items.filter((r) => r.status === 'active');

    return { items, total };
  }

  async create(dto: CreateBlockRuleDto, createdBy?: number): Promise<BlockRuleDto> {
    const value = this.normalizeIdentifier(dto.type, dto.value);
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

  private normalizeIdentifier(type: BlockType, raw: string): string {
    if (type === 'PHONE') return normalizeBdPhone(raw) ?? raw;
    if (type === 'EMAIL') return raw.toLowerCase();
    return raw;
  }

  // ADDENDUM §E — rules the fraud gate / blocker rule engine create
  // themselves (source=AUTO). Same unique-constraint idempotency as a
  // manual create: re-triggering the same value just refreshes the row.
  async autoBlock(
    type: BlockType,
    rawValue: string,
    category: string,
    reason: string,
    opts: { metadata?: Record<string, unknown>; durationMinutes?: number } = {},
  ): Promise<BlockRuleDto> {
    const value = this.normalizeIdentifier(type, rawValue);
    const expiresAt = opts.durationMinutes ? new Date(Date.now() + opts.durationMinutes * 60_000) : null;
    const row = await this.prisma.client.blockRule.upsert({
      where: { type_value: { type, value } },
      create: {
        type,
        value,
        source: 'AUTO',
        category,
        reason,
        expiresAt,
        metadata: (opts.metadata as Prisma.InputJsonValue) ?? undefined,
      },
      update: {
        source: 'AUTO',
        category,
        reason,
        isActive: true,
        expiresAt,
        metadata: (opts.metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });
    return toBlockRuleDto(row);
  }

  async getSettings(): Promise<BlockerSettings> {
    return this.settings.getNamespace('blocker', BLOCKER_SETTINGS_DEFAULTS);
  }

  // Shallow-merges nested blobs (rules/thresholds/popup/manual) against the
  // current settings before writing — a caller that only patches one rule's
  // config must not wipe out every other rule's config in the same JSON blob.
  async updateSettings(dto: Partial<BlockerSettings>): Promise<BlockerSettings> {
    const current = await this.getSettings();
    const merged: Partial<BlockerSettings> = { ...dto };
    if (dto.rules) merged.rules = { ...current.rules, ...dto.rules } as BlockerSettings['rules'];
    if (dto.thresholds) merged.thresholds = { ...current.thresholds, ...dto.thresholds } as BlockerSettings['thresholds'];
    if (dto.popup) merged.popup = { ...current.popup, ...dto.popup } as BlockerSettings['popup'];
    if (dto.manual) merged.manual = { ...current.manual, ...dto.manual } as BlockerSettings['manual'];
    await this.settings.setNamespace('blocker', merged);
    return this.getSettings();
  }

  // Called from the checkout fraud gate when a checkout is actually
  // rejected — self-checks the fraud rule's enabled flag isn't relevant
  // here; this is a distinct, always-available hook fraud.ts calls.
  async maybeAutoBlockFraud(phone: string): Promise<void> {
    const settings = await this.getSettings();
    if (!settings.enabled) return;
    await this.autoBlock('PHONE', phone, 'fraud', 'Auto-blocked: checkout rejected by the fraud gate', {
      durationMinutes: settings.defaultDurationMinutes,
    });
  }

  async setActive(id: number, isActive: boolean): Promise<BlockRuleDto> {
    const row = await this.prisma.client.blockRule.update({ where: { id }, data: { isActive } });
    return toBlockRuleDto(row);
  }

  async bulkUnblock(source: BlockSource): Promise<number> {
    const result = await this.prisma.client.blockRule.updateMany({
      where: { source, isActive: true },
      data: { isActive: false },
    });
    return result.count;
  }

  async remove(id: number): Promise<void> {
    await this.prisma.client.blockRule.delete({ where: { id } });
  }

  private candidates(input: BlockCheckInput): { type: BlockType; value: string }[] {
    const candidates: { type: BlockType; value: string }[] = [];
    if (input.phone) {
      const normalized = normalizeBdPhone(input.phone);
      if (normalized) candidates.push({ type: 'PHONE', value: normalized });
    }
    if (input.email) candidates.push({ type: 'EMAIL', value: input.email.toLowerCase() });
    if (input.ip) candidates.push({ type: 'IP', value: input.ip });
    if (input.deviceId) candidates.push({ type: 'DEVICE', value: input.deviceId });
    if (input.name) candidates.push({ type: 'NAME', value: input.name.toLowerCase() });
    return candidates;
  }

  private async findActiveMatch(input: BlockCheckInput, source: BlockSource): Promise<BlockRule | null> {
    const candidates = this.candidates(input);
    const now = new Date();

    if (candidates.length > 0) {
      const row = await this.prisma.client.blockRule.findFirst({
        where: {
          source,
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          AND: { OR: candidates.map((c) => ({ type: c.type, value: { equals: c.value, mode: 'insensitive' } })) },
        },
      });
      if (row) return row;
    }

    const variants = addressVariants(input.address ?? '');
    if (variants.length === 0) return null;

    const addressRules = await this.prisma.client.blockRule.findMany({
      where: { source, type: { in: ADDRESS_TYPES }, isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      orderBy: { id: 'desc' },
    });
    for (const rule of addressRules) {
      const identifier = normalizeMatchText(rule.value);
      if (!identifier) continue;
      if (variants.some((v) => v.includes(identifier) || identifier.includes(v))) return rule;
    }
    return null;
  }

  // Checkout-side guard (§7.6) — phone, email, IP, device, name, and
  // address, checked for every payment method. Only active, unexpired
  // rules block; an admin "inactive" toggle or an expired timed block
  // silently stops applying rather than needing deletion.
  async check(input: BlockCheckInput): Promise<{ blocked: boolean; rule?: BlockRuleDto }> {
    const manual = await this.findActiveMatch(input, 'MANUAL');
    if (manual) return { blocked: true, rule: toBlockRuleDto(manual) };
    const auto = await this.findActiveMatch(input, 'AUTO');
    if (auto) return { blocked: true, rule: toBlockRuleDto(auto) };
    return { blocked: false };
  }

  // Full checkout-time evaluation: manual block -> pre-existing auto block
  // -> the 12-rule auto engine. A newly-triggered auto rule gets persisted
  // and (only in that branch, matching the plugin) logs a fraud saving —
  // repeat hits against an already-blocked identifier don't re-log.
  async evaluateCheckout(context: BlockCheckoutContext): Promise<CheckoutBlockResult> {
    const settings = await this.getSettings();
    if (!settings.enabled) return { blocked: false };

    const checkInput: BlockCheckInput = {
      phone: context.phone,
      email: context.email,
      ip: context.ip,
      deviceId: context.deviceId,
      name: context.name,
      address: context.address,
    };

    const manual = await this.findActiveMatch(checkInput, 'MANUAL');
    if (manual) return this.popupResult(settings, 'manual', manual.reason);

    const existingAuto = await this.findActiveMatch(checkInput, 'AUTO');
    if (existingAuto) {
      const ruleKey = (existingAuto.category ?? '') as keyof typeof settings.rules;
      return this.popupResult(settings, settings.rules[ruleKey] ? ruleKey : undefined, existingAuto.reason);
    }

    const match = await this.rules.evaluate(context, settings);
    if (!match) return { blocked: false };

    const ruleConfig = settings.rules[match.rule];
    const identifierType = this.identifierTypeFor(match.rule);
    const identifierValue = this.identifierValueFor(identifierType, context);

    await this.autoBlock(identifierType, identifierValue, match.rule, match.reason, {
      metadata: match.metadata,
      durationMinutes: ruleConfig.durationMinutes || settings.defaultDurationMinutes,
    });

    if (context.orderTotal > 0 && context.phone) {
      const amount = await this.fraud.savingAmountFor(context.orderTotal);
      await this.fraud.recordSaving(context.phone, amount, 'blocked').catch(() => undefined);
    }

    return this.popupResult(settings, match.rule, match.reason);
  }

  private identifierTypeFor(rule: string): BlockType {
    if (rule === 'ipTracker' || rule === 'proxyTorDetection' || rule === 'speedBotDetection') return 'IP';
    if (rule === 'blacklistedEmailDomain') return 'EMAIL';
    return 'PHONE';
  }

  private identifierValueFor(type: BlockType, context: BlockCheckoutContext): string {
    if (type === 'EMAIL') return context.email;
    if (type === 'IP') return context.ip;
    return context.phone;
  }

  private popupResult(settings: BlockerSettings, ruleKey: string | undefined, reason: string | null): CheckoutBlockResult {
    const ruleConfig = ruleKey && ruleKey in settings.rules ? settings.rules[ruleKey as keyof typeof settings.rules] : undefined;
    const heading = ruleConfig?.heading || (ruleKey === 'manual' ? settings.manual.heading : settings.popup.defaultHeading);
    const sub = ruleConfig?.sub || (ruleKey === 'manual' ? settings.manual.sub : settings.popup.defaultSub);
    const customReason = ruleConfig?.message || (ruleKey === 'manual' ? settings.manual.message : '') || reason || '';
    const showReason = settings.showReasonInPopup && customReason !== '';

    return {
      blocked: true,
      heading: heading || settings.popup.defaultHeading,
      sub: sub || settings.popup.defaultSub,
      reason: showReason ? customReason : undefined,
      showReason,
      contacts: {
        call: settings.popup.callEnabled ? settings.popup.callNumber : undefined,
        whatsapp: settings.popup.whatsappEnabled ? settings.popup.whatsappNumber : undefined,
        email: settings.popup.emailEnabled ? settings.popup.emailAddress : undefined,
      },
    };
  }

  async stats(): Promise<{ todayAuto: number; yesterdayAuto: number; monthTotal: number; allTime: number; active: number }> {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayAuto, yesterdayAuto, monthTotal, allTime, active] = await Promise.all([
      this.prisma.client.blockRule.count({ where: { source: 'AUTO', createdAt: { gte: startOfToday } } }),
      this.prisma.client.blockRule.count({ where: { source: 'AUTO', createdAt: { gte: startOfYesterday, lt: startOfToday } } }),
      this.prisma.client.blockRule.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.client.blockRule.count(),
      this.prisma.client.blockRule.count({ where: { isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } }),
    ]);

    return { todayAuto, yesterdayAuto, monthTotal, allTime, active };
  }

  async exportCsv(source?: 'MANUAL' | 'AUTO'): Promise<string> {
    const { items } = await this.list({ source, pageSize: 5000 });
    const header = ['id', 'source', 'category', 'type', 'value', 'status', 'reason', 'expiresAt', 'createdAt'];
    const lines = [header.join(',')];
    for (const r of items) {
      lines.push(
        [r.id, r.source, r.category ?? '', r.type, r.value, r.status, r.reason ?? '', r.expiresAt?.toISOString() ?? '', r.createdAt.toISOString()]
          .map(csvField)
          .join(','),
      );
    }
    return lines.join('\n');
  }

  // Columns: type,value,reason,duration(minutes; 0/blank = permanent),note
  async importCsv(csvText: string, createdBy?: number): Promise<{ imported: number; skipped: number }> {
    const rows = parseCsv(csvText);
    let imported = 0;
    let skipped = 0;
    for (const row of rows) {
      const [rawType, value, reason, durationRaw, note] = row;
      if (!rawType || !value || rawType.toLowerCase() === 'type') continue;
      const type = rawType.toUpperCase() as BlockType;
      if (!['PHONE', 'EMAIL', 'IP', 'DEVICE', 'NAME', 'ADDRESS'].includes(type)) {
        skipped++;
        continue;
      }
      const duration = Number(durationRaw) || 0;
      try {
        await this.create(
          {
            type,
            value,
            reason: reason || 'CSV import.',
            note: note || undefined,
            expiresAt: duration > 0 ? new Date(Date.now() + duration * 60_000).toISOString() : undefined,
          } as CreateBlockRuleDto,
          createdBy,
        );
        imported++;
      } catch {
        skipped++;
      }
    }
    return { imported, skipped };
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

function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Minimal quoted-field-aware CSV line/column parser — good enough for the
// admin-authored import files this endpoint expects (no embedded newlines
// inside quoted fields across chunk boundaries; a full RFC 4180 parser
// isn't warranted for a bulk-block import tool).
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

export { ruleStatus, RULE_LABELS };
