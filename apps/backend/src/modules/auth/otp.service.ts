import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { OtpPurpose } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OTP_NOTIFIER } from './notification/otp-notifier.interface';
import type { OtpNotifier } from './notification/otp-notifier.interface';

const OTP_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OTP_NOTIFIER) private readonly notifier: OtpNotifier,
  ) {}

  async request(identifier: string, purpose: OtpPurpose): Promise<void> {
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
      where: {
        identifier,
        purpose,
        code,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw new UnauthorizedException('Invalid or expired OTP');
    await this.prisma.client.otp.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });
  }
}
