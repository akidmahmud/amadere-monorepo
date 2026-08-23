import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { CreateCashAccountDto } from './dto/create-cash-account.dto';
import { UpdateCashAccountDto } from './dto/update-cash-account.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';

const Decimal = Prisma.Decimal;

export interface CashAccountDto {
  id: number;
  name: string;
  type: string;
  accountNumber: string | null;
  openingBalance: string;
  openingDate: Date;
  /** Computed from the ledger, never stored. */
  balance: string;
  isActive: boolean;
  sortOrder: number;
}

export interface LedgerRowDto {
  id: number;
  entryDate: Date;
  direction: string;
  amount: string;
  source: string;
  partyId: number | null;
  reference: string | null;
  note: string | null;
}

function decimalOrThrow(value: string, field: string): Prisma.Decimal {
  try {
    return new Decimal(value);
  } catch {
    throw new BadRequestException(`${field} must be a number`);
  }
}

/**
 * Cash, bank and mobile-wallet accounts.
 *
 * Balances are computed as openingBalance + sum(IN) - sum(OUT) rather than
 * kept in a column, so they cannot drift from the entries that justify them.
 * If that ever becomes slow, cache it then — a stored balance is a
 * reconciliation problem waiting to happen.
 */
@Injectable()
export class CashAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  private toDto(row: {
    id: number;
    name: string;
    type: string;
    accountNumber: string | null;
    openingBalance: Prisma.Decimal;
    openingDate: Date;
    isActive: boolean;
    sortOrder: number;
  }, balance: Prisma.Decimal): CashAccountDto {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      accountNumber: row.accountNumber,
      openingBalance: row.openingBalance.toFixed(2),
      openingDate: row.openingDate,
      balance: balance.toFixed(2),
      isActive: row.isActive,
      sortOrder: row.sortOrder,
    };
  }

  async list(includeInactive = false): Promise<CashAccountDto[]> {
    const rows = await this.prisma.client.cashAccount.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    // Two queries for every account, not two per account.
    const balances = await this.ledgerService.accountBalances();
    return rows.map((row) => this.toDto(row, balances.get(row.id) ?? row.openingBalance));
  }

  async create(dto: CreateCashAccountDto): Promise<CashAccountDto> {
    const opening = decimalOrThrow(dto.openingBalance ?? '0', 'openingBalance');
    const row = await this.prisma.client.cashAccount.create({
      data: {
        name: dto.name.trim(),
        type: dto.type,
        accountNumber: dto.accountNumber ?? null,
        openingBalance: opening,
        openingDate: new Date(dto.openingDate),
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    return this.toDto(row, await this.ledgerService.accountBalance(row.id));
  }

  async update(id: number, dto: UpdateCashAccountDto): Promise<CashAccountDto> {
    const existing = await this.prisma.client.cashAccount.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Cash account ${id} not found`);

    const row = await this.prisma.client.cashAccount.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.accountNumber !== undefined ? { accountNumber: dto.accountNumber } : {}),
        ...(dto.openingBalance !== undefined
          ? { openingBalance: decimalOrThrow(dto.openingBalance, 'openingBalance') }
          : {}),
        ...(dto.openingDate !== undefined ? { openingDate: new Date(dto.openingDate) } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
    return this.toDto(row, await this.ledgerService.accountBalance(row.id));
  }

  async ledger(
    id: number,
    from?: string,
    to?: string,
  ): Promise<{ opening: string; entries: LedgerRowDto[]; closing: string }> {
    const account = await this.prisma.client.cashAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException(`Cash account ${id} not found`);

    // Opening is the balance as at the day before the range starts, so the
    // range's own entries are not counted twice.
    const dayBefore = from ? new Date(new Date(from).getTime() - 86_400_000) : undefined;
    const opening = await this.ledgerService.accountBalance(id, dayBefore);
    const closing = await this.ledgerService.accountBalance(id, to ? new Date(to) : undefined);

    const entries = await this.prisma.client.ledgerEntry.findMany({
      where: {
        accountId: id,
        ...(from || to
          ? {
              entryDate: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ entryDate: 'asc' }, { id: 'asc' }],
    });

    return {
      opening: opening.toFixed(2),
      closing: closing.toFixed(2),
      entries: entries.map((e) => ({
        id: e.id,
        entryDate: e.entryDate,
        direction: e.direction,
        amount: e.amount.toFixed(2),
        source: e.source,
        partyId: e.partyId,
        reference: e.reference,
        note: e.note,
      })),
    };
  }

  async transfer(dto: CreateTransferDto, adminId: number): Promise<{ out: number; in: number }> {
    if (dto.fromAccountId === dto.toAccountId) {
      throw new BadRequestException('Choose two different accounts');
    }
    const amount = decimalOrThrow(dto.amount, 'amount');
    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Transfer amount must be greater than zero');
    }
    const entryDate = new Date(dto.transferDate);

    // Both legs in one transaction: a half-written transfer would invent or
    // destroy money.
    return this.prisma.client.$transaction(async (tx) => {
      const out = await this.ledgerService.post(
        {
          entryDate,
          direction: 'OUT',
          amount,
          accountId: dto.fromAccountId,
          source: 'TRANSFER',
          reference: dto.reference,
          note: dto.note,
        },
        adminId,
        tx,
      );
      const inn = await this.ledgerService.post(
        {
          entryDate,
          direction: 'IN',
          amount,
          accountId: dto.toAccountId,
          source: 'TRANSFER',
          reference: dto.reference,
          note: dto.note,
        },
        adminId,
        tx,
      );
      return { out: out.id, in: inn.id };
    });
  }
}
