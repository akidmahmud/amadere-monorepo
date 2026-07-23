import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SuccessResponseDto } from '../../common/dto/success-response.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { hashPassword, verifyPassword } from '../../common/auth/password.util';
import {
  CustomerProfileDto,
  toCustomerProfileDto,
} from '../auth/customer.mapper';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from '../auth/dto/change-password.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { AddressDto, toAddressDto } from './address.mapper';
import { Prisma } from '@amader/db';
import { PaginatedResult } from '@amader/shared';
import { paginationArgs, toPaginatedResult } from '../../common/pagination.util';
import { toE164Bd } from '../../common/phone.util';
import { CALL_PROVIDER } from './providers/call-provider.interface';
import type { CallProvider } from './providers/call-provider.interface';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateCustomerNoteDto } from './dto/create-customer-note.dto';
import { CreateCustomerCallLogDto } from './dto/create-customer-call-log.dto';
import { AdminCustomerQueryDto } from './dto/admin-customer-query.dto';
import {
  ADMIN_CUSTOMER_LIST_INCLUDE,
  ADMIN_CUSTOMER_DETAIL_INCLUDE,
  AdminCustomerDto,
  AdminCustomerListExtras,
  AdminCustomerListItemDto,
  AdminCustomerNoteDto,
  AdminCustomerCallLogDto,
  AdminCustomerStatsDto,
  toAdminCustomerListItemDto,
  toAdminCustomerDto,
} from './admin-customer.mapper';

export interface AssignableStaffDto {
  id: number;
  name: string;
}

const EMPTY_EXTRAS: AdminCustomerListExtras = { address: null, lastOrderDate: null, topProduct: null, lifetimeSpend: 0 };

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CALL_PROVIDER) private readonly callProvider: CallProvider,
  ) {}

  async getProfile(customerId: number): Promise<CustomerProfileDto> {
    const customer = await this.prisma.client.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return toCustomerProfileDto(customer);
  }

  async updateProfile(
    customerId: number,
    dto: UpdateProfileDto,
  ): Promise<CustomerProfileDto> {
    const customer = await this.prisma.client.customer.update({
      where: { id: customerId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        avatarUrl: dto.avatarUrl,
        dob: dto.dob ? new Date(dto.dob) : undefined,
      },
    });
    return toCustomerProfileDto(customer);
  }

  async changePassword(
    customerId: number,
    dto: ChangePasswordDto,
  ): Promise<SuccessResponseDto> {
    const customer = await this.prisma.client.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer?.passwordHash) {
      throw new BadRequestException(
        'This account has no password set (OTP/social login only)',
      );
    }
    const valid = await verifyPassword(
      dto.currentPassword,
      customer.passwordHash,
    );
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const passwordHash = await hashPassword(dto.newPassword);
    await this.prisma.client.customer.update({
      where: { id: customerId },
      data: { passwordHash },
    });
    return { success: true };
  }

  async listAddresses(customerId: number): Promise<AddressDto[]> {
    const addresses = await this.prisma.client.customerAddress.findMany({
      where: { customerId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return addresses.map(toAddressDto);
  }

  async createAddress(
    customerId: number,
    dto: CreateAddressDto,
  ): Promise<AddressDto> {
    return this.prisma.client.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.customerAddress.updateMany({
          where: { customerId },
          data: { isDefault: false },
        });
      }
      const address = await tx.customerAddress.create({
        data: { ...dto, customerId },
      });
      return toAddressDto(address);
    });
  }

  async updateAddress(
    customerId: number,
    id: number,
    dto: UpdateAddressDto,
  ): Promise<AddressDto> {
    await this.assertOwnsAddress(customerId, id);
    return this.prisma.client.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.customerAddress.updateMany({
          where: { customerId },
          data: { isDefault: false },
        });
      }
      const address = await tx.customerAddress.update({
        where: { id },
        data: dto,
      });
      return toAddressDto(address);
    });
  }

  async deleteAddress(
    customerId: number,
    id: number,
  ): Promise<SuccessResponseDto> {
    await this.assertOwnsAddress(customerId, id);
    await this.prisma.client.customerAddress.delete({ where: { id } });
    return { success: true };
  }

  private async assertOwnsAddress(customerId: number, id: number) {
    const address = await this.prisma.client.customerAddress.findUnique({
      where: { id },
    });
    if (!address || address.customerId !== customerId) {
      throw new NotFoundException('Address not found');
    }
  }

  // Each whitespace-separated word in `q` must match SOMEWHERE (name/phone/
  // email) — not the whole query string against one field. A plain
  // single-field `contains: query.q` search (the previous approach) fails
  // for the completely normal case of typing a customer's full name, since
  // "Import Test" is never a substring of firstName="Import" alone or
  // lastName="Test One" alone; it only shows up once the two are
  // concatenated, which nothing here does.
  private async buildAdminWhere(query: AdminCustomerQueryDto): Promise<Prisma.CustomerWhereInput> {
    let birthdayIds: number[] | undefined;
    if (query.birthdayToday) {
      // Bangladesh is a fixed UTC+6, no DST — "today" for this feature means
      // today in Dhaka, not the server's (likely UTC) local date, which
      // would be wrong for several hours around midnight BDT.
      const dhakaNow = new Date(Date.now() + 6 * 60 * 60 * 1000);
      const rows = await this.prisma.client.$queryRaw<{ id: number }[]>`
        SELECT id FROM customers
        WHERE dob IS NOT NULL
          AND EXTRACT(MONTH FROM dob) = ${dhakaNow.getUTCMonth() + 1}
          AND EXTRACT(DAY FROM dob) = ${dhakaNow.getUTCDate()}
      `;
      birthdayIds = rows.map((r) => r.id);
    }
    return {
      ...(query.tierId ? { tierId: query.tierId } : {}),
      ...(birthdayIds ? { id: { in: birthdayIds } } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.crmStatus ? { crmStatus: query.crmStatus } : {}),
      ...(query.assignedAdminId ? { assignedAdminId: query.assignedAdminId } : {}),
      ...(query.district ? { addresses: { some: { district: { equals: query.district, mode: 'insensitive' } } } } : {}),
      ...(query.q
        ? {
            AND: query.q
              .trim()
              .split(/\s+/)
              .map((word) => ({
                OR: [
                  { firstName: { contains: word, mode: 'insensitive' as const } },
                  { lastName: { contains: word, mode: 'insensitive' as const } },
                  { phone: { contains: word } },
                  { email: { contains: word, mode: 'insensitive' as const } },
                ],
              })),
          }
        : {}),
    };
  }

  async adminList(query: AdminCustomerQueryDto): Promise<PaginatedResult<AdminCustomerListItemDto>> {
    const where = await this.buildAdminWhere(query);
    const [items, total] = await Promise.all([
      this.prisma.client.customer.findMany({
        where,
        include: ADMIN_CUSTOMER_LIST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...paginationArgs(query.page, query.pageSize),
      }),
      this.prisma.client.customer.count({ where }),
    ]);
    const extras = await this.loadListExtras(items.map((c) => c.id));
    return toPaginatedResult(
      items.map((c) => toAdminCustomerListItemDto(c, extras.get(c.id) ?? EMPTY_EXTRAS)),
      total,
      query.page,
      query.pageSize,
    );
  }

  // Default address, last order date, lifetime spend, and top-purchased
  // product for the given customer IDs — computed via a few grouped queries
  // over just this page's rows, not per-row (N+1) queries.
  private async loadListExtras(customerIds: number[]): Promise<Map<number, AdminCustomerListExtras>> {
    const extras = new Map<number, AdminCustomerListExtras>();
    if (customerIds.length === 0) return extras;

    const [addresses, orderAggregates, orders] = await Promise.all([
      this.prisma.client.customerAddress.findMany({
        where: { customerId: { in: customerIds } },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.client.order.groupBy({
        by: ['customerId'],
        where: { customerId: { in: customerIds } },
        _sum: { totalAmount: true },
        _max: { createdAt: true },
      }),
      this.prisma.client.order.findMany({
        where: { customerId: { in: customerIds } },
        select: { customerId: true, items: { select: { productNameSnapshot: true, quantity: true } } },
      }),
    ]);

    const addressByCustomer = new Map<number, (typeof addresses)[number]>();
    for (const a of addresses) {
      if (!addressByCustomer.has(a.customerId)) addressByCustomer.set(a.customerId, a);
    }

    const quantityByCustomerProduct = new Map<number, Map<string, number>>();
    for (const o of orders) {
      if (o.customerId === null) continue;
      let perProduct = quantityByCustomerProduct.get(o.customerId);
      if (!perProduct) {
        perProduct = new Map();
        quantityByCustomerProduct.set(o.customerId, perProduct);
      }
      for (const item of o.items) {
        perProduct.set(item.productNameSnapshot, (perProduct.get(item.productNameSnapshot) ?? 0) + item.quantity);
      }
    }

    const aggByCustomer = new Map(orderAggregates.filter((a) => a.customerId !== null).map((a) => [a.customerId as number, a]));

    for (const id of customerIds) {
      const address = addressByCustomer.get(id);
      const perProduct = quantityByCustomerProduct.get(id);
      let topProduct: string | null = null;
      if (perProduct) {
        let topQty = 0;
        for (const [name, qty] of perProduct) {
          if (qty > topQty) {
            topQty = qty;
            topProduct = `${name} x${qty}`;
          }
        }
      }
      const agg = aggByCustomer.get(id);
      extras.set(id, {
        address: address ? (address.area ? `${address.area}, ${address.district}` : address.addressLine) : null,
        lastOrderDate: agg?._max.createdAt ?? null,
        lifetimeSpend: agg?._sum.totalAmount ? Number(agg._sum.totalAmount) : 0,
        topProduct,
      });
    }
    return extras;
  }

  async adminStats(): Promise<AdminCustomerStatsDto> {
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      totalCustomers,
      totalAsOfLastMonth,
      newThisMonth,
      newLastMonth,
      activeCustomers,
      repeatCustomers,
      aovAgg,
    ] = await Promise.all([
      this.prisma.client.customer.count({ where: { deletedAt: null } }),
      this.prisma.client.customer.count({ where: { deletedAt: null, createdAt: { lt: startOfThisMonth } } }),
      this.prisma.client.customer.count({ where: { deletedAt: null, createdAt: { gte: startOfThisMonth } } }),
      this.prisma.client.customer.count({
        where: { deletedAt: null, createdAt: { gte: startOfLastMonth, lt: startOfThisMonth } },
      }),
      this.prisma.client.customer.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      this.prisma.client.customer.count({ where: { deletedAt: null, completedOrderCount: { gte: 2 } } }),
      this.prisma.client.order.aggregate({ _avg: { totalAmount: true } }),
    ]);

    return {
      totalCustomers,
      totalCustomersTrendPct: totalAsOfLastMonth > 0 ? ((totalCustomers - totalAsOfLastMonth) / totalAsOfLastMonth) * 100 : null,
      newCustomersThisMonth: newThisMonth,
      newCustomersTrendPct: newLastMonth > 0 ? ((newThisMonth - newLastMonth) / newLastMonth) * 100 : null,
      activeCustomers,
      repeatCustomers,
      averageOrderValue: aovAgg._avg.totalAmount ? Number(aovAgg._avg.totalAmount) : 0,
    };
  }

  async adminExportCsv(query: AdminCustomerQueryDto): Promise<string> {
    const where = await this.buildAdminWhere(query);
    const items = await this.prisma.client.customer.findMany({
      where,
      include: ADMIN_CUSTOMER_LIST_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 10_000,
    });
    const extras = await this.loadListExtras(items.map((c) => c.id));
    const rows = items.map((c) => toAdminCustomerListItemDto(c, extras.get(c.id) ?? EMPTY_EXTRAS));
    const header = 'Name,Phone,Email,Group,Completed Orders,Priority,Status,Assigned To,Joined';
    const lines = rows.map(
      (r) =>
        `"${r.name}",${r.phone ?? ''},${r.email ?? ''},${r.tier ?? ''},${r.completedOrderCount},${r.priority ?? ''},${r.crmStatus ?? ''},"${r.assignedAdminName ?? ''}",${new Date(r.createdAt).toISOString().slice(0, 10)}`,
    );
    return [header, ...lines].join('\n');
  }

  async listAssignableStaff(): Promise<AssignableStaffDto[]> {
    const staff = await this.prisma.client.adminUser.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      orderBy: { firstName: 'asc' },
      select: { id: true, firstName: true, lastName: true },
    });
    return staff.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}`.trim() }));
  }

  async adminGet(id: number): Promise<AdminCustomerDto> {
    const customer = await this.prisma.client.customer.findUnique({
      where: { id },
      include: ADMIN_CUSTOMER_DETAIL_INCLUDE,
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return toAdminCustomerDto(customer);
  }

  async createCustomer(dto: CreateCustomerDto): Promise<AdminCustomerDto> {
    const existing = await this.prisma.client.customer.findUnique({
      where: { phone: dto.phone },
    });
    if (existing) {
      throw new ConflictException(`A customer with phone "${dto.phone}" already exists`);
    }
    const customer = await this.prisma.client.customer.create({
      data: {
        phone: dto.phone,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
      },
    });
    return this.adminGet(customer.id);
  }

  async adminUpdate(id: number, dto: UpdateCustomerDto): Promise<AdminCustomerDto> {
    await this.prisma.client.customer.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        dob: dto.dob === undefined ? undefined : dto.dob ? new Date(dto.dob) : null,
        isFavorite: dto.isFavorite,
        assignedAdminId: dto.assignedAdminId,
        nextCallTarget: dto.nextCallTarget === undefined ? undefined : dto.nextCallTarget ? new Date(dto.nextCallTarget) : null,
        followUpCadenceDays: dto.followUpCadenceDays,
        hasNewOrder: dto.hasNewOrder,
        newOrderAt: dto.newOrderAt === undefined ? undefined : dto.newOrderAt ? new Date(dto.newOrderAt) : null,
        priority: dto.priority,
        crmStatus: dto.crmStatus,
        behaviour: dto.behaviour,
        customerFeedback: dto.customerFeedback,
        amaderFeedback: dto.amaderFeedback,
        familyDetails: dto.familyDetails,
        purchaseReason: dto.purchaseReason,
        facebookProfileUrl: dto.facebookProfileUrl,
      },
    });
    return this.adminGet(id);
  }

  async addNote(customerId: number, dto: CreateCustomerNoteDto, authorAdminId: number): Promise<AdminCustomerNoteDto> {
    const note = await this.prisma.client.customerNote.create({
      data: { customerId, type: dto.type, body: dto.body, authorAdminId },
    });
    return { id: note.id, type: note.type, body: note.body, authorAdminId: note.authorAdminId, createdAt: note.createdAt };
  }

  async listNotes(customerId: number): Promise<AdminCustomerNoteDto[]> {
    const notes = await this.prisma.client.customerNote.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
    return notes.map((n) => ({ id: n.id, type: n.type, body: n.body, authorAdminId: n.authorAdminId, createdAt: n.createdAt }));
  }

  async logCall(customerId: number, dto: CreateCustomerCallLogDto, authorAdminId: number): Promise<AdminCustomerCallLogDto> {
    const customer = await this.prisma.client.customer.findUniqueOrThrow({ where: { id: customerId } });
    const call = await this.prisma.client.customerCallLog.create({
      data: {
        customerId,
        phoneCalled: customer.phone ?? '',
        outcome: dto.outcome,
        notes: dto.notes,
        authorAdminId,
      },
    });
    return {
      id: call.id,
      phoneCalled: call.phoneCalled,
      outcome: call.outcome,
      notes: call.notes,
      authorAdminId: call.authorAdminId,
      createdAt: call.createdAt,
    };
  }

  async listCalls(customerId: number): Promise<AdminCustomerCallLogDto[]> {
    const calls = await this.prisma.client.customerCallLog.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
    return calls.map((call) => ({
      id: call.id,
      phoneCalled: call.phoneCalled,
      outcome: call.outcome,
      notes: call.notes,
      authorAdminId: call.authorAdminId,
      createdAt: call.createdAt,
    }));
  }

  async dial(customerId: number): Promise<{ providerCallId: string }> {
    const customer = await this.prisma.client.customer.findUniqueOrThrow({ where: { id: customerId } });
    const e164 = customer.phone ? toE164Bd(customer.phone) : null;
    if (!e164) throw new BadRequestException('Customer has no valid phone number to call');
    return this.callProvider.dial(e164, customerId);
  }

  // Rows with a phone that already exists as a Customer are skipped, not
  // merged/overwritten — importing a bad file must never silently corrupt
  // an existing customer's data. Columns: name,phone,email,dob (dob
  // optional, YYYY-MM-DD).
  async importCsv(csvText: string): Promise<{ imported: number; skipped: number }> {
    const rows = parseCsv(csvText);
    let imported = 0;
    let skipped = 0;
    for (const row of rows) {
      const [name, phone, email, dob] = row;
      if (!phone || phone.toLowerCase() === 'phone') continue;
      const existing = await this.prisma.client.customer.findUnique({ where: { phone } });
      if (existing) {
        skipped++;
        continue;
      }
      const [firstName, ...rest] = (name || '').trim().split(/\s+/).filter(Boolean);
      try {
        await this.prisma.client.customer.create({
          data: {
            phone,
            email: email || undefined,
            firstName: firstName || undefined,
            lastName: rest.length ? rest.join(' ') : undefined,
            dob: dob ? new Date(dob) : undefined,
          },
        });
        imported++;
      } catch {
        skipped++;
      }
    }
    return { imported, skipped };
  }
}

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
