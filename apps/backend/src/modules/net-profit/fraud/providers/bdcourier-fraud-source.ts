import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { toLocalBdPhone } from '@amader/shared';
import { CredentialsService } from '../../../../common/credentials/credentials.service';
import { FraudSource, FraudSourceOutcome } from '../fraud-source.interface';

const BASE_URL = 'https://api.bdcourier.com';
const CREDENTIAL_KEY = 'fraud.bdcourier.apiKey';
/**
 * The API is a third party sitting on the checkout path — never let it hang a
 * customer. Measured at ~750-850ms for a real check, so 3.5s is roughly 4x the
 * observed worst case: generous enough that a slow-but-working response still
 * lands, short enough that an outage costs the shopper a moment rather than an
 * abandoned checkout. On timeout the source reports `unavailable` and the gate
 * falls through to the configured no-history behaviour.
 */
const TIMEOUT_MS = 3_500;

/** One courier's row in the response. Every field is a plain count. */
interface BdCourierEntry {
  name?: string;
  total_parcel?: number;
  success_parcel?: number;
  cancelled_parcel?: number;
}

interface BdCourierCheckResponse {
  status?: string;
  data?: Record<string, BdCourierEntry | undefined> & {
    summary?: BdCourierEntry;
  };
}

/**
 * bdcourier.com — one call returns this phone's delivery history across
 * Pathao, SteadFast, RedX, PaperFly, ParcelDex, CourierFast and CarryBee.
 *
 * This REPLACES SteadfastFraudSource rather than joining it. FraudService sums
 * the totals of every source it is given, and bdcourier's response already
 * contains SteadFast's numbers — running both would count every SteadFast
 * parcel twice and quietly inflate the success ratio the whole gate is scored
 * on. SteadfastFraudSource is left wired as the standby to swap back to.
 *
 * `unavailable` on every failure path (no key, non-200, malformed body, quota
 * exhausted, timeout). FraudService already treats that as "no data" and falls
 * back to the configured `allowNoHistory` behaviour, which is the right call
 * for a checkout gate: a third party being down must never block a real sale.
 */
@Injectable()
export class BdCourierFraudSource implements FraudSource {
  readonly name = 'BDCOURIER';
  private readonly logger = new Logger(BdCourierFraudSource.name);

  constructor(
    private readonly credentials: CredentialsService,
    private readonly config: ConfigService,
  ) {}

  /** Stored encrypted at rest like every other vendor secret; the env var is
   *  the bootstrap path for a fresh environment that has no Setting row yet. */
  private async apiKey(): Promise<string | null> {
    return (
      (await this.credentials.getCredential(CREDENTIAL_KEY)) ??
      this.config.get<string>('BDCOURIER_API_KEY') ??
      null
    );
  }

  async check(phoneMsisdn: string): Promise<FraudSourceOutcome> {
    const apiKey = await this.apiKey();
    if (!apiKey) {
      this.logger.warn(`No ${CREDENTIAL_KEY} configured — bdcourier check skipped`);
      return { unavailable: true };
    }

    // The API's own examples use the local 11-digit form (017xxxxxxxx), not
    // the 880-prefixed MSISDN the rest of this codebase passes around.
    const phone = toLocalBdPhone(phoneMsisdn);
    if (!phone) return { unavailable: true };

    let body: BdCourierCheckResponse;
    try {
      const res = await fetch(`${BASE_URL}/courier-check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ phone }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        this.logger.warn(`bdcourier returned HTTP ${res.status} for a courier-check`);
        return { unavailable: true };
      }
      body = (await res.json()) as BdCourierCheckResponse;
    } catch (err) {
      this.logger.warn(
        `bdcourier courier-check failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { unavailable: true };
    }

    if (body.status !== 'success' || !body.data?.summary) return { unavailable: true };

    const summary = body.data.summary;
    const byCourier: Record<string, { total: number; delivered: number; cancelled: number }> = {};

    for (const [key, entry] of Object.entries(body.data)) {
      if (key === 'summary' || !entry) continue;
      const total = entry.total_parcel ?? 0;
      // Couriers this customer has never used come back as all-zero rows.
      // Dropping them keeps the stored breakdown to couriers that actually
      // say something about this phone.
      if (total === 0) continue;
      byCourier[key.toUpperCase()] = {
        total,
        delivered: entry.success_parcel ?? 0,
        cancelled: entry.cancelled_parcel ?? 0,
      };
    }

    return {
      total: summary.total_parcel ?? 0,
      delivered: summary.success_parcel ?? 0,
      cancelled: summary.cancelled_parcel ?? 0,
      byCourier,
    };
  }
}
