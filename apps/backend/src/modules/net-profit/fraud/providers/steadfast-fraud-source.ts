import { Injectable } from '@nestjs/common';
import { SteadfastCourierProvider } from '../../../courier/providers/steadfast-courier.provider';
import { FraudSource, FraudSourceOutcome } from '../fraud-source.interface';

// Thin adapter — reuses SteadfastCourierProvider.fraudCheck() (the real,
// verified-live endpoint) rather than duplicating the HTTP call. Pathao/
// RedX/eCourier have no proven fraud endpoint at all yet, so there's no
// equivalent adapter for them; a future third-party BD aggregator would be
// a second FraudSource here, aggregated alongside this one.
@Injectable()
export class SteadfastFraudSource implements FraudSource {
  readonly name = 'STEADFAST';

  constructor(private readonly steadfast: SteadfastCourierProvider) {}

  async check(phoneMsisdn: string): Promise<FraudSourceOutcome> {
    const outcome = await this.steadfast.fraudCheck!(phoneMsisdn);
    if (outcome.unavailable) return { unavailable: true };
    return {
      total: outcome.total,
      delivered: outcome.delivered,
      cancelled: outcome.cancelled,
      byCourier: { STEADFAST: { total: outcome.total, delivered: outcome.delivered, cancelled: outcome.cancelled } },
    };
  }
}
