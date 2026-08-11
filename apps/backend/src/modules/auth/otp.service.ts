import { Injectable, Inject, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { OtpPurpose } from '@amader/db';
import { normalizeBdPhone } from '@amader/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OTP_NOTIFIER } from './notification/otp-notifier.interface';
import type { OtpNotifier } from './notification/otp-notifier.interface';

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_REQUESTS_PER_HOUR = 5;
const MAX_VERIFY_ATTEMPTS = 5;

// `identifier` reaches this service in whatever raw shape the caller has on
// hand — RegisterDto.phone is @NormalizeBdPhone()-decorated ("+8801..."),
// but OtpRequestDto/OtpVerifyDto.identifier deliberately isn't (it's
// ambiguously phone-or-email, see customer-auth.service.ts's own comment on
// this), and the frontend's OTP-verify screen just echoes back whatever the
// customer originally typed in the phone field (e.g. "01712345678"), not
// the normalized form the register() call actually stored the code under.
// Without this, a correct SMS code fails verification with "Invalid or
// expired OTP" purely because the two Prisma lookups used different literal
// strings for the same phone number — normalizing here makes every caller's
// shape collapse to the same DB key. Left untouched for email identifiers.
function normalizeIdentifier(identifier: string): string {
  if (identifier.includes('@')) return identifier;
  return normalizeBdPhone(identifier) ?? identifier;
}

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OTP_NOTIFIER) private readonly notifier: OtpNotifier,
  ) {}

  async request(identifier: string, purpose: OtpPurpose): Promise<void> {
    const normalized = normalizeIdentifier(identifier);
    const recentCount = await this.prisma.client.otp.count({
      where: { identifier: normalized, purpose, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
    });
    if (recentCount >= MAX_REQUESTS_PER_HOUR) {
      throw new BadRequestException('Too many OTP requests — please try again later');
    }

    const code = randomInt(100000, 1000000).toString();
    await this.prisma.client.otp.create({
      data: {
        identifier: normalized,
        purpose,
        code,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });
    await this.notifier.send(normalized, code);
  }

  async verify(
    identifier: string,
    code: string,
    purpose: OtpPurpose,
  ): Promise<void> {
    const normalized = normalizeIdentifier(identifier);
    const otp = await this.prisma.client.otp.findFirst({
      where: { identifier: normalized, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp || otp.attempts >= MAX_VERIFY_ATTEMPTS) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }
    if (otp.code !== code) {
      await this.prisma.client.otp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw new UnauthorizedException('Invalid or expired OTP');
    }
    await this.prisma.client.otp.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });
  }
}
