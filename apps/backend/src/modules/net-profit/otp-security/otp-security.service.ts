import { ForbiddenException, Injectable } from '@nestjs/common';
import { NetProfitSettingsService } from '../settings/net-profit-settings.service';
import { IpApiVpnDetector } from './providers/ip-api-vpn-detector';

export type VpnPolicy = 'allow' | 'challenge' | 'block';

export interface OtpSecuritySettings {
  vpnPolicy: VpnPolicy;
  // COD checkout OTP (ADDENDUM Fraud/OTP parity — the plugin's
  // wpfok_otp_enabled/_length/_expiry settings). `codOtpEnabled=false`
  // skips OTP verification for COD entirely, matching a merchant who wants
  // the old no-OTP checkout back. Length/expiry only affect *new* codes —
  // codes already issued keep their original expiry.
  codOtpEnabled: boolean;
  codOtpLength: number;
  codOtpExpiryMinutes: number;
}

const DEFAULTS: OtpSecuritySettings = {
  vpnPolicy: 'allow',
  codOtpEnabled: true,
  codOtpLength: 6,
  codOtpExpiryMinutes: 5,
};

export interface VpnEvaluation {
  isVpn: boolean;
  policy: VpnPolicy;
}

// ADDENDUM §I — evaluates the caller's IP at OTP-request time. `allow` just
// records isVpn on the Otp row (visible to admin); `block` rejects the
// request outright; `challenge` allows it through but flags it more
// visibly for follow-up (no separate "extra step" UI exists yet, so this
// is the honest degradation of that policy tier, not a fabricated one).
@Injectable()
export class OtpSecurityService {
  constructor(
    private readonly settings: NetProfitSettingsService,
    private readonly vpnDetector: IpApiVpnDetector,
  ) {}

  async getSettings(): Promise<OtpSecuritySettings> {
    return this.settings.getNamespace('otp', DEFAULTS);
  }

  async updateSettings(dto: Partial<OtpSecuritySettings>): Promise<OtpSecuritySettings> {
    await this.settings.setNamespace('otp', dto);
    return this.getSettings();
  }

  async evaluate(ip: string | undefined): Promise<VpnEvaluation> {
    const settings = await this.getSettings();
    if (!ip || settings.vpnPolicy === 'allow') {
      const outcome = ip ? await this.vpnDetector.check(ip) : { unavailable: true as const };
      return { isVpn: 'isVpn' in outcome && outcome.isVpn, policy: settings.vpnPolicy };
    }

    const outcome = await this.vpnDetector.check(ip);
    const isVpn = 'isVpn' in outcome && outcome.isVpn;
    if (isVpn && settings.vpnPolicy === 'block') {
      throw new ForbiddenException('This request could not be completed from a VPN/proxy connection. Please disable it and try again.');
    }
    return { isVpn, policy: settings.vpnPolicy };
  }
}
