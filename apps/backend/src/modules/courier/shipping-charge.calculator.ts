import { Injectable } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';

const Decimal = Prisma.Decimal;

// Weight-accurate courier charging (AGENTS.md §6/§11): base fee + per-kg
// rate + an outside-Dhaka surcharge, all tunable via the Setting store so
// rate changes never need a deploy. Not Steadfast's own billed fee (they
// weigh and charge the merchant account separately) — this is what we
// estimate/display as the order's shippingAmount.
@Injectable()
export class ShippingChargeCalculator {
  constructor(private readonly prisma: PrismaService) {}

  async calculate(
    weightKg: Prisma.Decimal,
    division: string,
  ): Promise<Prisma.Decimal> {
    const [base, perKg, surcharge] = await Promise.all([
      this.getSetting('courier_base_fee', 60),
      this.getSetting('courier_per_kg_fee', 20),
      this.getSetting('courier_outside_dhaka_surcharge', 40),
    ]);

    let total = base.plus(perKg.times(weightKg));
    if (division.trim().toLowerCase() !== 'dhaka') {
      total = total.plus(surcharge);
    }
    return total.toDecimalPlaces(2);
  }

  private async getSetting(
    key: string,
    fallback: number,
  ): Promise<Prisma.Decimal> {
    const setting = await this.prisma.client.setting.findUnique({
      where: { key },
    });
    const raw = setting?.value;
    if (typeof raw !== 'number' && typeof raw !== 'string')
      return new Decimal(fallback);
    return new Decimal(raw);
  }
}
