import { Injectable } from '@nestjs/common';
import { CourierProviderName, Prisma } from '@amader/db';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { parseCourierBill } from './courier-bills';

export interface BillImportResult {
  rows: number;
  matched: number;
  updated: number;
  unmatched: string[];
}

/** Courier statement → shipments.billed_charge. Re-importing overwrites (latest statement wins). */
@Injectable()
export class CourierBillsService {
  constructor(private readonly prisma: PrismaService) {}

  async import(
    provider: CourierProviderName,
    csv: string,
    ref: string,
  ): Promise<BillImportResult> {
    const { rows } = parseCourierBill(csv);
    const shipments = await this.prisma.client.shipment.findMany({
      where: {
        provider,
        consignmentId: { in: rows.map((r) => r.consignmentId) },
      },
      select: { id: true, consignmentId: true },
    });
    const byId = new Map(shipments.map((s) => [s.consignmentId, s.id]));
    const unmatched: string[] = [];
    let updated = 0;
    const now = new Date();
    for (const r of rows) {
      const id = byId.get(r.consignmentId);
      if (!id) {
        unmatched.push(r.consignmentId);
        continue;
      }
      await this.prisma.client.shipment.update({
        where: { id },
        data: {
          billedCharge: new Prisma.Decimal(r.charge),
          billedAt: now,
          billImportRef: ref,
        },
      });
      updated++;
    }
    return {
      rows: rows.length,
      matched: rows.length - unmatched.length,
      updated,
      unmatched,
    };
  }
}
