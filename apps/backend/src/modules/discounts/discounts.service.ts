import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginatedResult } from '@amader/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  paginationArgs,
  toPaginatedResult,
} from '../../common/pagination.util';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { UpdateDiscountDto } from './dto/update-discount.dto';
import { DISCOUNT_INCLUDE, DiscountDto, toDiscountDto } from './discounts.mapper';

@Injectable()
export class DiscountsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<DiscountDto>> {
    const [items, total] = await Promise.all([
      this.prisma.client.discount.findMany({
        include: DISCOUNT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.discount.count(),
    ]);
    return toPaginatedResult(items.map(toDiscountDto), total, page, pageSize);
  }

  async get(id: number): Promise<DiscountDto> {
    const discount = await this.prisma.client.discount.findUnique({
      where: { id },
      include: DISCOUNT_INCLUDE,
    });
    if (!discount) throw new NotFoundException('Discount not found');
    return toDiscountDto(discount);
  }

  async create(dto: CreateDiscountDto): Promise<DiscountDto> {
    this.validateShape(dto);
    if (dto.code) await this.assertCodeAvailable(dto.code);

    const discount = await this.prisma.client.discount.create({
      data: {
        code: dto.code,
        type: dto.type,
        valueType: dto.valueType,
        value: dto.value,
        minOrderAmount: dto.minOrderAmount,
        maxUsesTotal: dto.maxUsesTotal,
        maxUsesPerCustomer: dto.maxUsesPerCustomer,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
        status: dto.status,
        products: dto.productIds
          ? { create: dto.productIds.map((productId) => ({ productId })) }
          : undefined,
        categories: dto.categoryIds
          ? { create: dto.categoryIds.map((categoryId) => ({ categoryId })) }
          : undefined,
        customers: dto.customerIds
          ? { create: dto.customerIds.map((customerId) => ({ customerId })) }
          : undefined,
      },
      include: DISCOUNT_INCLUDE,
    });
    return toDiscountDto(discount);
  }

  async update(id: number, dto: UpdateDiscountDto): Promise<DiscountDto> {
    await this.get(id);
    if (dto.code) await this.assertCodeAvailable(dto.code, id);

    if (dto.productIds) {
      await this.prisma.client.discountProduct.deleteMany({
        where: { discountId: id },
      });
    }
    if (dto.categoryIds) {
      await this.prisma.client.discountCategory.deleteMany({
        where: { discountId: id },
      });
    }
    if (dto.customerIds) {
      await this.prisma.client.discountCustomer.deleteMany({
        where: { discountId: id },
      });
    }

    const discount = await this.prisma.client.discount.update({
      where: { id },
      data: {
        code: dto.code,
        type: dto.type,
        valueType: dto.valueType,
        value: dto.value,
        minOrderAmount: dto.minOrderAmount,
        maxUsesTotal: dto.maxUsesTotal,
        maxUsesPerCustomer: dto.maxUsesPerCustomer,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
        status: dto.status,
        products: dto.productIds
          ? { create: dto.productIds.map((productId) => ({ productId })) }
          : undefined,
        categories: dto.categoryIds
          ? { create: dto.categoryIds.map((categoryId) => ({ categoryId })) }
          : undefined,
        customers: dto.customerIds
          ? { create: dto.customerIds.map((customerId) => ({ customerId })) }
          : undefined,
      },
      include: DISCOUNT_INCLUDE,
    });
    return toDiscountDto(discount);
  }

  async delete(id: number): Promise<void> {
    await this.get(id);
    await this.prisma.client.discount.delete({ where: { id } });
  }

  private validateShape(dto: CreateDiscountDto): void {
    if (dto.type === 'COUPON' && !dto.code) {
      throw new BadRequestException('A coupon requires a code');
    }
    if (dto.type === 'PROMOTION' && dto.code) {
      throw new BadRequestException(
        'A promotion is auto-applied and must not have a code',
      );
    }
    if (dto.valueType === 'PERCENTAGE' && dto.value > 100) {
      throw new BadRequestException('Percentage value cannot exceed 100');
    }
  }

  private async assertCodeAvailable(
    code: string,
    excludeId?: number,
  ): Promise<void> {
    const existing = await this.prisma.client.discount.findUnique({
      where: { code },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Code "${code}" is already in use`);
    }
  }
}
