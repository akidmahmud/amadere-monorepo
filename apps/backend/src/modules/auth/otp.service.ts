import { Injectable, Inject, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { OtpPurpose } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OTP_NOTIFIER } from './notification/otp-notifier.interface';
import type { OtpNotifier } from './notification/otp-notifier.interface';

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_REQUESTS_PER_HOUR = 5;
const MAX_VERIFY_ATTEMPTS = 5;

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OTP_NOTIFIER) private readonly notifier: OtpNotifier,
  ) {}

  async request(identifier: string, purpose: OtpPurpose): Promise<void> {
    const recentCount = await this.prisma.client.otp.count({
      where: { identifier, purpose, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
    });
    if (recentCount >= MAX_REQUESTS_PER_HOUR) {
      throw new BadRequestException('Too many OTP requests — please try again later');
    }

    const code = randomInt(100000, 1000000).toString();
    await this.prisma.client.otp.create({
      data: {
        identifier,
        purpose,
        code,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });
    await this.notifier.send(identifier, code);
  }

  async verify(
    identifier: string,
    code: string,
    purpose: OtpPurpose,
  ): Promise<void> {
    const otp = await this.prisma.client.otp.findFirst({
      where: { identifier, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
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
