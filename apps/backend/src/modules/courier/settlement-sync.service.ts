import { Injectable, Logger } from '@nestjs/common';
import { CourierProviderName, Prisma } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ShipmentsService } from './shipments.service';

const Decimal = Prisma.Decimal;

/** One payout as Steadfast reports it. Field names are theirs, verified
 *  against live data — see the parser for what each one means. */
interface SteadfastPayoutSummary {
  payment_id?: string;
  amount?: number;
  due_bills?: number;
  charges?: number;
  total?: number;
  status_label?: string;
  created_at?: string;
  paid_at?: string | null;
}

interface SteadfastConsignmentLine {
  consignment_id?: number | string;
  cod_amount?: number;
  status?: string;
}

export interface SettlementSyncResult {
  payoutsScanned: number;
  parcelsSeen: number;
  parcelsMatched: number;
  shipmentsUpdated: number;
  /** Parcels in the payouts that this system does not know about — shipped
   *  through some other channel on the same courier account. Reported because
   *  it is why a payout's total charge cannot be divided across our orders. */
  parcelsUnknown: number;
  discrepancies: {
    consignmentId: string;
    orderId: number;
    asked: string;
    collected: string;
  }[];
  stopped: string;
}

function asNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Pulls what the courier actually collected, per parcel, off their settlement
 * API and onto our shipment rows.
 *
 * Why this exists: `shipments.cod_amount` is what we ASKED the courier to
 * collect. It is not what they collected, and on live data those differ —
 * silently, in our favour's opposite direction.
 *
 * Deliberately does NOT post anything to the ledger. CodSettlement (party,
 * cash account, expense) stays a staff-initiated accounting action; this is
 * read-only fact-gathering that such a posting can later be built on.
 */
@Injectable()
export class SettlementSyncService {
  private readonly logger = new Logger(SettlementSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly shipments: ShipmentsService,
  ) {}

  /**
   * Walks payouts newest-first and stops early once a whole page matched
   * nothing new — payouts are append-only and never revised, so there is no
   * reason to re-read years of history on every run.
   *
   * `maxPages` is a hard stop so a first run on a long-lived account cannot
   * turn into an unbounded crawl of someone else's API.
   */
  async sync(
    provider: CourierProviderName = 'STEADFAST',
    opts: { maxPages?: number; full?: boolean } = {},
  ): Promise<SettlementSyncResult> {
    const maxPages = Math.min(opts.maxPages ?? 5, 40);
    const result: SettlementSyncResult = {
      payoutsScanned: 0,
      parcelsSeen: 0,
      parcelsMatched: 0,
      shipmentsUpdated: 0,
      parcelsUnknown: 0,
      discrepancies: [],
      stopped: 'reached maxPages',
    };

    // The list is oldest-first, so the newest payouts are on the LAST page.
    // Find the end before walking backwards.
    const lastPage = await this.findLastPage(provider);
    if (lastPage === null) {
      result.stopped = 'settlement API unavailable';
      return result;
    }

    for (let i = 0; i < maxPages; i += 1) {
      const page = lastPage - i;
      if (page < 1) {
        result.stopped = 'reached the first page';
        break;
      }

      const payouts = await this.fetchPage(provider, page);
      if (payouts.length === 0) {
        result.stopped = `page ${page} was empty`;
        break;
      }

      let updatedOnThisPage = 0;
      for (const payout of payouts) {
        if (!payout.payment_id) continue;
        result.payoutsScanned += 1;
        updatedOnThisPage += await this.applyPayout(provider, payout, result);
      }

      // An entire page of payouts that changed nothing means we have caught
      // up with history. Skipped when `full` is asked for explicitly.
      if (!opts.full && updatedOnThisPage === 0 && i > 0) {
        result.stopped = `page ${page} had nothing new`;
        break;
      }
    }

    return result;
  }

  // ------------------------------------------------------------------

  /** Doubling probe then binary search — the API exposes no page count, and
   *  walking from page 1 would read the whole history to find the end. */
  private async findLastPage(provider: CourierProviderName): Promise<number | null> {
    const has = async (page: number) => (await this.fetchPage(provider, page)).length > 0;

    if (!(await has(1))) return null;

    let hi = 1;
    while (await has(hi * 2)) {
      hi *= 2;
      if (hi > 512) break; // absurd-account guard
    }
    let lo = hi;
    hi *= 2;
    while (lo + 1 < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (await has(mid)) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  private async fetchPage(
    provider: CourierProviderName,
    page: number,
  ): Promise<SteadfastPayoutSummary[]> {
    const res = await this.shipments.getPayments(provider, { page });
    if (res.unavailable) return [];
    const body = res.raw as { payments?: unknown } | null;
    return Array.isArray(body?.payments) ? (body.payments as SteadfastPayoutSummary[]) : [];
  }

  /** Returns how many shipment rows this payout actually changed. */
  private async applyPayout(
    provider: CourierProviderName,
    payout: SteadfastPayoutSummary,
    result: SettlementSyncResult,
  ): Promise<number> {
    const detail = await this.shipments.getPayments(provider, { id: payout.payment_id });
    if (detail.unavailable) return 0;

    const body = detail.raw as { payment?: { consignments?: unknown } } | null;
    const lines = body?.payment?.consignments;
    if (!Array.isArray(lines)) return 0;

    const settledAt = payout.paid_at ?? payout.created_at ?? null;
    const settledDate = settledAt ? new Date(settledAt) : null;

    let updated = 0;
    for (const line of lines as SteadfastConsignmentLine[]) {
      const cid = line.consignment_id;
      if (cid === undefined || cid === null) continue;
      result.parcelsSeen += 1;

      const consignmentId = String(cid);
      const shipment = await this.prisma.client.shipment.findFirst({
        where: { consignmentId },
        select: { id: true, orderId: true, codAmount: true, settledCodAmount: true },
        orderBy: { createdAt: 'desc' },
      });
      if (!shipment) {
        result.parcelsUnknown += 1;
        continue;
      }
      result.parcelsMatched += 1;

      const collected = new Decimal(asNumber(line.cod_amount) ?? 0);

      // What we asked for vs what came back. Surfaced, never silently
      // absorbed — this is real money going missing one order at a time.
      if (shipment.codAmount && !shipment.codAmount.equals(collected)) {
        result.discrepancies.push({
          consignmentId,
          orderId: shipment.orderId,
          asked: shipment.codAmount.toString(),
          collected: collected.toString(),
        });
      }

      const unchanged =
        shipment.settledCodAmount !== null && shipment.settledCodAmount.equals(collected);
      if (unchanged) continue;

      await this.prisma.client.shipment.update({
        where: { id: shipment.id },
        data: {
          settledCodAmount: collected,
          settlementReference: payout.payment_id ?? null,
          settlementStatus: line.status ?? null,
          settledAt: settledDate && !Number.isNaN(settledDate.getTime()) ? settledDate : null,
        },
      });
      updated += 1;
      result.shipmentsUpdated += 1;
    }

    return updated;
  }
}
