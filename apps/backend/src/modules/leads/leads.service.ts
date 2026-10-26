import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  CallOutcome,
  CustomerPriority,
  LeadCallOutcome,
  LeadStatus,
  Prisma,
} from '@amader/db';
import { phoneLookupCandidates } from '@amader/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { paginationArgs, toPaginatedResult } from '../../common/pagination.util';
import {
  cellText,
  normalizeImportPhone,
  readSheet,
  staffLookup,
  toDate,
} from '../customers/customer-import';
import { ORDER_CREATED_EVENT, type OrderCreatedEvent } from '../orders/orders.events';
import { dhakaDate } from '../product-cost-history/dhaka-date';
import type { CreateLeadDto, LeadQueryDto, LogLeadCallDto, UpdateLeadDto } from './dto/lead.dto';

/** Still a lead: not converted to a customer, not deleted. */
const OPEN = { convertedAt: null, deletedAt: null } as const;

const LIST_INCLUDE = {
  assignedAdmin: { select: { firstName: true, lastName: true } },
  _count: { select: { calls: true } },
} as const;

const DETAIL_INCLUDE = {
  assignedAdmin: { select: { firstName: true, lastName: true } },
  calls: {
    orderBy: { createdAt: 'desc' as const },
    include: { author: { select: { firstName: true, lastName: true } } },
  },
} as const;

const fullName = (a: { firstName: string; lastName: string } | null | undefined) =>
  a ? `${a.firstName} ${a.lastName}`.trim() : null;

/** "2026-10-26" → that Dhaka day as a date-only value; null clears. */
const toDay = (v: string | null | undefined) =>
  v === undefined ? undefined : v ? new Date(`${v}T00:00:00.000Z`) : null;

/** What a call outcome says about the lead's status, if anything. */
export function statusAfterCall(
  current: LeadStatus,
  outcome: LeadCallOutcome,
): { status: LeadStatus; lostReason?: string } {
  switch (outcome) {
    case 'DO_NOT_CALL':
      return { status: 'DNC' };
    case 'NOT_INTERESTED':
      return { status: 'LOST', lostReason: 'Not interested' };
    case 'WRONG_NUMBER':
      return { status: 'LOST', lostReason: 'Wrong number' };
    case 'ANSWERED_INTERESTED':
      return { status: 'INTERESTED' };
    case 'ANSWERED_CALL_BACK':
      return { status: 'FOLLOW_UP' };
    default:
      return { status: current === 'NEW' ? 'CONTACTED' : current };
  }
}

/** A lead call, as the customer call log records it once the lead converts. */
const CUSTOMER_OUTCOME: Record<LeadCallOutcome, CallOutcome> = {
  ANSWERED_INTERESTED: 'CONNECTED',
  ANSWERED_CALL_BACK: 'CONNECTED',
  ANSWERED_REGULAR_BUYER: 'CONNECTED',
  ANSWERED_WHOLESALE: 'CONNECTED',
  ORDER_PLACED: 'CONNECTED',
  NO_ANSWER: 'NO_ANSWER',
  BUSY: 'NO_ANSWER',
  NUMBER_OFF: 'NO_ANSWER',
  NOT_INTERESTED: 'DECLINED',
  DO_NOT_CALL: 'DECLINED',
  WRONG_NUMBER: 'WRONG_NUMBER',
};

// Lead sheet headers (lower-cased, letters only) → field.
const LEAD_HEADERS: Record<string, string> = {
  name: 'name', customername: 'name',
  number: 'phone', phone: 'phone', mobile: 'phone', phonenumber: 'phone', mobilenumber: 'phone',
  location: 'addressLine', address: 'addressLine',
  district: 'district', thana: 'area', area: 'area',
  email: 'email',
  assignto: 'assignTo', assignedto: 'assignTo',
  interestedproduct: 'interestedProduct', product: 'interestedProduct',
  leadsource: 'leadSource', source: 'leadSource',
  leaddate: 'leadDate', date: 'leadDate',
  priority: 'priority',
  calldate: 'callDate', lastcalldate: 'callDate',
  nextcalldate: 'nextCallDate', nextcall: 'nextCallDate', nextcalltarget: 'nextCallDate',
  customerfeedback: 'customerFeedback', feedback: 'customerFeedback',
  agentfeedback: 'agentFeedback', amaderfeedback: 'agentFeedback',
};

export interface LeadImportResult {
  dryRun: boolean;
  totalRows: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  skippedRows: { row: number; reason: string }[];
  warnings: string[];
}

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private toListItem(l: Prisma.LeadGetPayload<{ include: typeof LIST_INCLUDE }>) {
    const { assignedAdmin, _count, ...rest } = l;
    return { ...rest, assignedAdminName: fullName(assignedAdmin), callCount: _count.calls };
  }

  async list(q: LeadQueryDto) {
    const today = new Date(`${dhakaDate(new Date())}T00:00:00.000Z`);
    const term = q.q?.trim();
    const digits = term?.replace(/\D/g, '');
    const where: Prisma.LeadWhereInput = {
      ...OPEN,
      // The working list: Lost and Do-not-call leads only when asked for.
      ...(q.status ? { status: q.status } : { status: { notIn: ['LOST', 'DNC'] } }),
      ...(q.assigned
        ? { assignedAdminId: q.assigned === 'none' ? null : Number(q.assigned) }
        : {}),
      ...(q.view === 'due' ? { nextCallDate: { lte: today } } : {}),
      ...(term
        ? {
            OR: [
              { name: { contains: term, mode: 'insensitive' } },
              ...(digits && digits.length >= 3
                ? [{ phone: { contains: digits.replace(/^0/, '') } }]
                : []),
              { interestedProduct: { contains: term, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.lead.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...paginationArgs(q.page, q.pageSize),
      }),
      this.prisma.client.lead.count({ where }),
    ]);
    return toPaginatedResult(items.map((l) => this.toListItem(l)), total, q.page, q.pageSize);
  }

  async get(id: number) {
    const l = await this.prisma.client.lead.findFirst({
      where: { id, deletedAt: null },
      include: DETAIL_INCLUDE,
    });
    if (!l) throw new NotFoundException('Lead not found');
    const { assignedAdmin, calls, ...rest } = l;
    return {
      ...rest,
      assignedAdminName: fullName(assignedAdmin),
      calls: calls.map(({ author, ...c }) => ({ ...c, authorName: fullName(author) })),
    };
  }

  /** Normalised phone, refused if it's already an open lead or a customer. */
  private async freshPhone(raw: string, exceptLeadId?: number): Promise<string> {
    const phone = normalizeImportPhone(raw);
    if (!phone) throw new BadRequestException('Enter a valid Bangladeshi mobile number');
    const candidates = phoneLookupCandidates(phone);
    const [lead, customer] = await Promise.all([
      this.prisma.client.lead.findFirst({
        where: { ...OPEN, phone: { in: candidates }, ...(exceptLeadId ? { id: { not: exceptLeadId } } : {}) },
        select: { id: true },
      }),
      this.prisma.client.customer.findFirst({
        where: { phone: { in: candidates }, deletedAt: null },
        select: { id: true },
      }),
    ]);
    if (lead) throw new ConflictException(`This number is already a lead (#${lead.id})`);
    if (customer) throw new ConflictException(`This number is already a customer (#CUST-${customer.id})`);
    return phone;
  }

  private data(dto: UpdateLeadDto): Prisma.LeadUncheckedUpdateInput {
    const { phone: _phone, leadDate, nextCallDate, email, ...rest } = dto;
    return {
      ...rest,
      ...(email !== undefined ? { email: email ? email.toLowerCase() : null } : {}),
      leadDate: toDay(leadDate),
      nextCallDate: toDay(nextCallDate),
    };
  }

  async create(dto: CreateLeadDto) {
    const phone = await this.freshPhone(dto.phone);
    const l = await this.prisma.client.lead.create({
      data: {
        ...(this.data(dto) as Prisma.LeadUncheckedCreateInput),
        phone,
        leadDate: toDay(dto.leadDate) ?? new Date(`${dhakaDate(new Date())}T00:00:00.000Z`),
      },
    });
    return this.get(l.id);
  }

  async update(id: number, dto: UpdateLeadDto) {
    await this.get(id);
    const data = this.data(dto);
    if (dto.phone !== undefined) data.phone = await this.freshPhone(dto.phone, id);
    await this.prisma.client.lead.update({ where: { id }, data });
    return this.get(id);
  }

  async remove(id: number) {
    await this.get(id);
    await this.prisma.client.lead.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id };
  }

  /** Deleted leads (not converted), newest deletion first — to restore. */
  async listDeleted(q: LeadQueryDto) {
    const where: Prisma.LeadWhereInput = { deletedAt: { not: null }, convertedAt: null };
    const [items, total] = await Promise.all([
      this.prisma.client.lead.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: { deletedAt: 'desc' },
        ...paginationArgs(q.page, q.pageSize),
      }),
      this.prisma.client.lead.count({ where }),
    ]);
    return toPaginatedResult(items.map((l) => this.toListItem(l)), total, q.page, q.pageSize);
  }

  /** Back into Lead Center — unless that number became a lead or customer meanwhile. */
  async restore(id: number) {
    const l = await this.prisma.client.lead.findFirst({ where: { id, deletedAt: { not: null } } });
    if (!l) throw new NotFoundException('Deleted lead not found');
    await this.freshPhone(l.phone);
    await this.prisma.client.lead.update({ where: { id }, data: { deletedAt: null } });
    return this.get(id);
  }

  async logCall(id: number, dto: LogLeadCallDto, adminId: number) {
    const lead = await this.get(id);
    const next = statusAfterCall(lead.status, dto.outcome);
    await this.prisma.client.$transaction([
      this.prisma.client.leadCallLog.create({
        data: { leadId: id, outcome: dto.outcome, notes: dto.notes?.trim() || null, authorAdminId: adminId },
      }),
      this.prisma.client.lead.update({
        where: { id },
        data: {
          lastCallAt: new Date(),
          status: next.status,
          ...(next.lostReason && !lead.lostReason ? { lostReason: next.lostReason } : {}),
          // Whoever calls an unassigned lead takes it.
          ...(lead.assignedAdminId === null ? { assignedAdminId: adminId } : {}),
        },
      }),
    ]);
    return this.get(id);
  }

  /**
   * The sales team's lead sheet (.xlsx/.csv), columns matched by header.
   * New numbers become leads; numbers already a lead or a customer are
   * skipped and reported. Dry run first, like the customer import.
   */
  async import(buffer: Buffer, dryRun: boolean): Promise<LeadImportResult> {
    const sheet = await readSheet(buffer);
    if (sheet.length === 0) throw new BadRequestException('The file is empty');
    const columns = sheet[0].cells.map((c) => LEAD_HEADERS[cellText(c).toLowerCase().replace(/[^a-z]/g, '')]);
    if (!columns.includes('phone'))
      throw new BadRequestException('No phone column found. The first row must be a header with a "Number" or "Phone" column.');
    const staff = await this.prisma.client.adminUser.findMany({
      where: { deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
    });
    const staffId = staffLookup(staff.map((s) => ({ id: s.id, name: fullName(s)! })));

    const result: LeadImportResult = {
      dryRun, totalRows: sheet.length - 1, created: 0, updated: 0, unchanged: 0, skipped: 0, skippedRows: [], warnings: [],
    };
    const unknownStaff = new Map<string, number>();
    const rows: Prisma.LeadCreateManyInput[] = [];
    const seen = new Set<string>();
    const phones = sheet.slice(1).map(({ cells }) => normalizeImportPhone(cellText(cells[columns.indexOf('phone')])));
    const known = phones.filter((p): p is string => !!p).flatMap((p) => phoneLookupCandidates(p));
    const [leads, customers] = await Promise.all([
      this.prisma.client.lead.findMany({ where: { ...OPEN, phone: { in: known } }, select: { phone: true } }),
      this.prisma.client.customer.findMany({ where: { phone: { in: known }, deletedAt: null }, select: { phone: true } }),
    ]);
    const isLead = new Set(leads.map((l) => l.phone));
    const isCustomer = new Set(customers.flatMap((c) => (c.phone ? phoneLookupCandidates(c.phone) : [])));

    sheet.slice(1).forEach(({ row, cells }, i) => {
      const get = (f: string) => {
        const idx = columns.indexOf(f);
        return idx === -1 ? undefined : cells[idx];
      };
      const text = (f: string) => cellText(get(f)) || undefined;
      const phone = phones[i];
      const skip = (reason: string) => {
        result.skipped++;
        result.skippedRows.push({ row, reason });
      };
      if (!phone) return skip(`"${text('phone') ?? ''}" is not a valid mobile number`);
      if (seen.has(phone)) return skip('Same number earlier in the file');
      seen.add(phone);
      if (isLead.has(phone)) {
        result.unchanged++;
        return;
      }
      if (isCustomer.has(phone)) return skip('Already a customer');
      const assignTo = text('assignTo');
      const assignedAdminId = staffId(assignTo);
      if (assignTo && !assignedAdminId) unknownStaff.set(assignTo, (unknownStaff.get(assignTo) ?? 0) + 1);
      const priority = text('priority')?.toUpperCase();
      const callDate = toDate(get('callDate'));
      rows.push({
        phone,
        name: text('name') ?? null,
        email: text('email')?.toLowerCase() ?? null,
        addressLine: text('addressLine') ?? null,
        district: text('district') ?? null,
        area: text('area') ?? null,
        leadSource: text('leadSource') ?? null,
        leadDate: toDate(get('leadDate')) ?? null,
        interestedProduct: text('interestedProduct') ?? null,
        assignedAdminId: assignedAdminId ?? null,
        priority: priority && priority in CustomerPriority ? (priority as CustomerPriority) : null,
        status: callDate ? 'CONTACTED' : 'NEW',
        lastCallAt: callDate ?? null,
        nextCallDate: toDate(get('nextCallDate')) ?? null,
        customerFeedback: text('customerFeedback') ?? null,
        agentFeedback: text('agentFeedback') ?? null,
      });
    });
    result.created = rows.length;
    result.warnings = [...unknownStaff].map(
      ([name, n]) => `Assign to "${name}" (${n} rows): no staff account with that name, left unassigned.`,
    );
    if (!dryRun && rows.length) await this.prisma.client.lead.createMany({ data: rows });
    return result;
  }

  /**
   * An order was placed for a lead's phone: the lead becomes that customer.
   * Its CRM fields fill the customer's empty ones, and its calls move into the
   * customer's call log. A customer created by this order is new, so it sits
   * at the top of All Customers; the order is at the top of Order Manager.
   */
  @OnEvent(ORDER_CREATED_EVENT, { async: true })
  async onOrderCreated(event: OrderCreatedEvent): Promise<void> {
    try {
      const order = await this.prisma.client.order.findUnique({
        where: { id: event.orderId },
        select: { id: true, customerId: true, channel: true, addresses: { where: { type: 'SHIPPING' }, take: 1, select: { phone: true } } },
      });
      const phone = order?.addresses[0]?.phone;
      if (!order || order.channel === 'POS' || !phone) return;
      const leads = await this.prisma.client.lead.findMany({
        where: { ...OPEN, phone: { in: phoneLookupCandidates(phone) } },
        include: { calls: true },
      });
      if (!leads.length) return;
      // The customer is matched/created by phone by CustomerOrderEventListener
      // on this same event, possibly a moment after us — wait briefly for it.
      // ponytail: short poll (≤3 s); an event chain if it ever needs to be exact.
      let customerId = order.customerId ?? event.customerId;
      for (let i = 0; !customerId && i < 10; i++) {
        await new Promise((r) => setTimeout(r, 300));
        customerId =
          (await this.prisma.client.order.findUnique({ where: { id: order.id }, select: { customerId: true } }))
            ?.customerId ?? null;
      }
      const customer = customerId
        ? await this.prisma.client.customer.findUnique({ where: { id: customerId } })
        : null;
      await this.prisma.client.$transaction(async (tx) => {
        for (const lead of leads) {
          await tx.lead.update({
            where: { id: lead.id },
            data: {
              status: 'CONVERTED',
              convertedAt: new Date(),
              convertedOrderId: order.id,
              convertedCustomerId: customer?.id ?? null,
            },
          });
          if (!customer) continue;
          const fill = <T>(current: T | null, value: T | null) => (current === null && value !== null ? value : undefined);
          await tx.customer.update({
            where: { id: customer.id },
            data: {
              assignedAdminId: fill(customer.assignedAdminId, lead.assignedAdminId),
              priority: fill(customer.priority, lead.priority),
              nextCallTarget: fill(customer.nextCallTarget, lead.nextCallDate),
              customerFeedback: fill(customer.customerFeedback, lead.customerFeedback),
              amaderFeedback: fill(customer.amaderFeedback, lead.agentFeedback),
              familyDetails: fill(customer.familyDetails, lead.familyDetails),
              purchaseReason: fill(customer.purchaseReason, lead.purchaseReason),
            },
          });
          if (lead.calls.length)
            await tx.customerCallLog.createMany({
              data: lead.calls.map((c) => ({
                customerId: customer.id,
                phoneCalled: lead.phone,
                outcome: CUSTOMER_OUTCOME[c.outcome],
                notes: [`Lead call: ${c.outcome.replace(/_/g, ' ').toLowerCase()}`, c.notes].filter(Boolean).join(' — '),
                authorAdminId: c.authorAdminId,
                createdAt: c.createdAt,
              })),
            });
        }
      });
      this.logger.log(`Lead(s) ${leads.map((l) => l.id).join(', ')} converted by order #${order.id}`);
    } catch (e) {
      // Never fails the order; the lead simply stays in the list.
      this.logger.error(`Lead conversion for order #${event.orderId} failed — ${(e as Error).message}`);
    }
  }
}
