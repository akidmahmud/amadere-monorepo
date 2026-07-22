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
  AdminCustomerListItemDto,
  AdminCustomerNoteDto,
  AdminCustomerCallLogDto,
  toAdminCustomerListItemDto,
  toAdminCustomerDto,
} from './admin-customer.mapper';

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

  async adminList(query: AdminCustomerQueryDto): Promise<PaginatedResult<AdminCustomerListItemDto>> {
    const where: Prisma.CustomerWhereInput = {
      ...(query.tierId ? { tierId: query.tierId } : {}),
      ...(query.q
        ? {
            OR: [
              { firstName: { contains: query.q, mode: 'insensitive' } },
              { lastName: { contains: query.q, mode: 'insensitive' } },
              { phone: { contains: query.q } },
              { email: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.customer.findMany({
        where,
        include: ADMIN_CUSTOMER_LIST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...paginationArgs(query.page, query.pageSize),
      }),
      this.prisma.client.customer.count({ where }),
    ]);
    return toPaginatedResult(items.map(toAdminCustomerListItemDto), total, query.page, query.pageSize);
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
      data: { firstName: dto.firstName, lastName: dto.lastName, dob: dto.dob },
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
