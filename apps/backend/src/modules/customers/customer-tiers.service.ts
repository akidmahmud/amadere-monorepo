import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdateCustomerTiersDto } from './dto/update-customer-tiers.dto';

export class CustomerTierDto {
  id!: number;
  label!: string;
  minCompletedOrders!: number;
  sortOrder!: number;
}

export class CustomerTierCountDto {
  id!: number;
  label!: string;
  count!: number;
}

// Tier thresholds are admin-editable (this task's endpoint) rather than a
// hardcoded enum — recomputeForCustomer/recomputeAll always read the
// current rows, never a cached list, so an edited threshold takes effect
// immediately for every customer.
@Injectable()
export class CustomerTiersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<CustomerTierDto[]> {
    return this.prisma.client.customerTier.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  // Real per-tier counts via a DB aggregate — the /customers list page's
  // stat cards previously derived these by fetching up to 1000 customer
  // rows and filtering client-side, which silently undercounted (showed 0
  // for every tier once the tiered customers fell outside the most-recent
  // 1000). This is a single indexed COUNT per tier instead.
  async countsByTier(): Promise<CustomerTierCountDto[]> {
    const tiers = await this.prisma.client.customerTier.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { customers: true } } },
    });
    return tiers.map((t) => ({ id: t.id, label: t.label, count: t._count.customers }));
  }

  // Full replace — the settings page always submits the complete tier set.
  // Existing rows not present in the new list are deleted; customers
  // pointing at a deleted tier get recomputed onto whatever tier now fits.
  async replace(tiers: UpdateCustomerTiersDto['tiers']): Promise<CustomerTierDto[]> {
    await this.prisma.client.$transaction(async (tx) => {
      await tx.customerTier.deleteMany({});
      await tx.customerTier.createMany({ data: tiers });
    });
    await this.recomputeAll();
    return this.list();
  }

  async recomputeForCustomer(customerId: number): Promise<void> {
    const completedOrderCount = await this.prisma.client.order.count({
      where: { customerId, status: 'COMPLETED' },
    });
    const tiers = await this.prisma.client.customerTier.findMany({
      orderBy: { minCompletedOrders: 'desc' },
    });
    const tier = tiers.find((t) => completedOrderCount >= t.minCompletedOrders) ?? null;
    await this.prisma.client.customer.update({
      where: { id: customerId },
      data: { completedOrderCount, tierId: tier?.id ?? null },
    });
  }

  async recomputeAll(): Promise<void> {
    const customers = await this.prisma.client.customer.findMany({ select: { id: true } });
    for (const c of customers) {
      await this.recomputeForCustomer(c.id);
    }
  }
}
