import {
  BadRequestException,
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

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

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
}
