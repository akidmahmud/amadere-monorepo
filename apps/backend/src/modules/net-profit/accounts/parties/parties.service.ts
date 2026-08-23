import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CourierProviderName, Prisma } from '@amader/db';
import { PaginatedResult } from '@amader/shared';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { paginationArgs, toPaginatedResult } from '../../../../common/pagination.util';
import { LedgerService, type PartyPosition } from '../ledger/ledger.service';
import { CreatePartyDto } from './dto/create-party.dto';
import { UpdatePartyDto } from './dto/update-party.dto';
import { PartyQueryDto } from './dto/party-query.dto';

const Decimal = Prisma.Decimal;
const EMPTY_POSITION: PartyPosition = {
  receivable: new Decimal(0),
  payable: new Decimal(0),
  net: new Decimal(0),
};

export interface PartyDto {
  id: number;
  name: string;
  type: string;
  roles: string[];
  phone: string | null;
  email: string | null;
  address: string | null;
  bin: string | null;
  tin: string | null;
  customerId: number | null;
  courierProvider: string | null;
  creditLimit: string | null;
  creditDays: number | null;
  /** Outstanding, derived from the ledger — not a stored balance. */
  receivable: string;
  payable: string;
  net: string;
  note: string | null;
  isActive: boolean;
}

export interface PartyStatement {
  party: PartyDto;
  entries: {
    id: number;
    entryDate: Date;
    direction: string;
    amount: string;
    source: string;
    reference: string | null;
    note: string | null;
  }[];
  dues: {
    id: number;
    docNo: string;
    kind: string;
    amount: string;
    issueDate: Date;
    dueDate: Date | null;
    source: string;
  }[];
  position: { receivable: string; payable: string; net: string };
}

type PartyRow = Prisma.PartyGetPayload<Record<string, never>>;

/**
 * The party master: one record per counterparty.
 *
 * Both expenses and dues used to carry a free-text name, which meant
 * "Steadfast" and "steadfast courier" were different counterparties, there was
 * nowhere to keep a supplier BIN (a Mushak 6.3 rebate claim needs one), and
 * the net position with a party who is simultaneously debtor and creditor was
 * unqueryable.
 */
@Injectable()
export class PartiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  private toDto(row: PartyRow, position: PartyPosition): PartyDto {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      roles: row.roles,
      phone: row.phone,
      email: row.email,
      address: row.address,
      bin: row.bin,
      tin: row.tin,
      customerId: row.customerId,
      courierProvider: row.courierProvider,
      creditLimit: row.creditLimit ? row.creditLimit.toFixed(2) : null,
      creditDays: row.creditDays,
      receivable: position.receivable.toFixed(2),
      payable: position.payable.toFixed(2),
      net: position.net.toFixed(2),
      note: row.note,
      isActive: row.isActive,
    };
  }

  async list(query: PartyQueryDto): Promise<PaginatedResult<PartyDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.PartyWhereInput = {
      deletedAt: null,
      ...(query.role ? { roles: { has: query.role } } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' as const } },
              { phone: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.client.party.findMany({
        where,
        orderBy: { name: 'asc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.party.count({ where }),
    ]);

    // One batched position lookup for the whole page. Asking per row cost two
    // queries per due per party, which on a 200-row page was thousands.
    const positions = await this.ledger.partyPositions(rows.map((r) => r.id));
    const items = rows.map((row) => this.toDto(row, positions.get(row.id) ?? EMPTY_POSITION));
    return toPaginatedResult(items, total, page, pageSize);
  }

  async findOne(id: number): Promise<PartyDto> {
    const row = await this.prisma.client.party.findUnique({ where: { id } });
    if (!row || row.deletedAt) throw new NotFoundException(`Party ${id} not found`);
    return this.toDto(row, await this.ledger.partyPosition(id));
  }

  private async assertCourierProviderFree(
    provider: CourierProviderName,
    excludeId?: number,
  ): Promise<void> {
    const clash = await this.prisma.client.party.findFirst({
      where: {
        courierProvider: provider,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (clash) {
      throw new BadRequestException(
        `${clash.name} is already the party for ${provider}. One party per provider.`,
      );
    }
  }

  async create(dto: CreatePartyDto, adminId: number): Promise<PartyDto> {
    if (!dto.roles?.length) {
      throw new BadRequestException('A party needs at least one role');
    }
    if (dto.courierProvider) await this.assertCourierProviderFree(dto.courierProvider);

    const row = await this.prisma.client.party.create({
      data: {
        name: dto.name.trim(),
        type: dto.type,
        roles: dto.roles,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        address: dto.address ?? null,
        bin: dto.bin ?? null,
        tin: dto.tin ?? null,
        customerId: dto.customerId ?? null,
        openingReceivable: new Decimal(dto.openingReceivable ?? 0),
        openingPayable: new Decimal(dto.openingPayable ?? 0),
        creditLimit: dto.creditLimit ? new Decimal(dto.creditLimit) : null,
        creditDays: dto.creditDays ?? null,
        courierProvider: dto.courierProvider ?? null,
        note: dto.note ?? null,
        isActive: dto.isActive ?? true,
      },
    });
    void adminId; // audit trail is captured by AuditLogInterceptor
    // A brand-new party has no dues yet, so its position is empty by
    // definition — no need to query for it.
    return this.toDto(row, EMPTY_POSITION);
  }

  async update(id: number, dto: UpdatePartyDto): Promise<PartyDto> {
    const existing = await this.prisma.client.party.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new NotFoundException(`Party ${id} not found`);
    if (dto.roles && dto.roles.length === 0) {
      throw new BadRequestException('A party needs at least one role');
    }
    if (dto.courierProvider) await this.assertCourierProviderFree(dto.courierProvider, id);

    const row = await this.prisma.client.party.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.roles !== undefined ? { roles: dto.roles } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.bin !== undefined ? { bin: dto.bin } : {}),
        ...(dto.tin !== undefined ? { tin: dto.tin } : {}),
        ...(dto.customerId !== undefined ? { customerId: dto.customerId } : {}),
        ...(dto.openingReceivable !== undefined
          ? { openingReceivable: new Decimal(dto.openingReceivable) }
          : {}),
        ...(dto.openingPayable !== undefined
          ? { openingPayable: new Decimal(dto.openingPayable) }
          : {}),
        ...(dto.creditLimit !== undefined ? { creditLimit: new Decimal(dto.creditLimit) } : {}),
        ...(dto.creditDays !== undefined ? { creditDays: dto.creditDays } : {}),
        ...(dto.courierProvider !== undefined ? { courierProvider: dto.courierProvider } : {}),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    return this.toDto(row, await this.ledger.partyPosition(id));
  }

  /**
   * Soft delete. A party is referenced by every voucher and due it has ever
   * appeared on; removing the row would orphan them.
   */
  async softDelete(id: number): Promise<{ id: number }> {
    const party = await this.prisma.client.party.findUnique({ where: { id } });
    if (!party) throw new NotFoundException(`Party ${id} not found`);
    await this.prisma.client.party.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return { id };
  }

  async statement(id: number, from?: string, to?: string): Promise<PartyStatement> {
    const row = await this.prisma.client.party.findUnique({ where: { id } });
    if (!row || row.deletedAt) throw new NotFoundException(`Party ${id} not found`);

    const range = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };

    const [entries, dues] = await Promise.all([
      this.prisma.client.ledgerEntry.findMany({
        where: { partyId: id, ...(from || to ? { entryDate: range } : {}) },
        orderBy: { entryDate: 'asc' },
      }),
      this.prisma.client.due.findMany({
        where: { partyId: id, voidedAt: null },
        orderBy: { issueDate: 'asc' },
      }),
    ]);

    const position = await this.ledger.partyPosition(id);

    return {
      party: this.toDto(row, position),
      entries: entries.map((e) => ({
        id: e.id,
        entryDate: e.entryDate,
        direction: e.direction,
        amount: e.amount.toFixed(2),
        source: e.source,
        reference: e.reference,
        note: e.note,
      })),
      dues: dues.map((d) => ({
        id: d.id,
        docNo: d.docNo,
        kind: d.kind,
        amount: d.amount.toFixed(2),
        issueDate: d.issueDate,
        dueDate: d.dueDate,
        source: d.source,
      })),
      position: {
        receivable: position.receivable.toFixed(2),
        payable: position.payable.toFixed(2),
        net: position.net.toFixed(2),
      },
    };
  }

  /**
   * The party a courier settles against.
   *
   * Deliberately has no default: silently falling back to Steadfast would
   * book another courier's payout against the wrong balance. Adding a new
   * courier is a party row, never a code change.
   */
  async resolveCourierParty(provider: CourierProviderName): Promise<{ id: number; name: string }> {
    const party = await this.prisma.client.party.findFirst({
      where: { courierProvider: provider, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!party) {
      throw new BadRequestException(
        `No party is mapped to courier ${provider}. Create one in Accounts > Parties and set its courier provider.`,
      );
    }
    return party;
  }
}
