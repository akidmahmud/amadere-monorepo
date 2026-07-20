import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TokenService } from '../../common/auth/token.service';
import { TokenPair } from '../../common/auth/token.types';
import { hashPassword, verifyPassword } from '../../common/auth/password.util';
import { OtpService } from './otp.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { TwoFactorVerifyDto } from './dto/two-factor-verify.dto';
import { TwoFactorEnableDto } from './dto/two-factor-enable.dto';
import {
  AdminProfileDto,
  AdminTwoFactorRequiredDto,
  toAdminProfileDto,
} from './admin.mapper';
import { ADMIN_LOGGED_IN_EVENT, AdminLoggedInEvent } from './auth.events';

export type AdminLoginResult = TokenPair | AdminTwoFactorRequiredDto;

// 2FA is email-OTP based (reuses the same Otp table/OtpService every other
// OTP flow in this app uses, under the ADMIN_LOGIN purpose) — not an
// authenticator-app/TOTP scheme, so there's no secret to generate or QR
// code to scan; "setting up" 2FA just means proving you can receive a code
// at your own account email.
@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly events: EventEmitter2,
    private readonly otp: OtpService,
  ) {}

  async login(
    dto: AdminLoginDto,
    ip: string | undefined,
    userAgent: string | undefined,
  ): Promise<AdminLoginResult> {
    const admin = await this.prisma.client.adminUser.findFirst({
      where: { email: dto.email, deletedAt: null, status: 'ACTIVE' },
    });

    const success =
      !!admin && (await verifyPassword(dto.password, admin.passwordHash));

    if (admin) {
      await this.prisma.client.adminLoginHistory.create({
        data: { adminUserId: admin.id, ipAddress: ip, userAgent, success },
      });
    }

    if (!admin || !success) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (
      admin.allowedIps.length > 0 &&
      (!ip || !admin.allowedIps.includes(ip))
    ) {
      throw new ForbiddenException('Login not allowed from this IP address');
    }

    if (admin.twoFactorEnabled) {
      await this.otp.request(admin.email, 'ADMIN_LOGIN');
      const twoFactorToken = await this.tokens.signAdminTwoFactorPendingToken(
        admin.id,
      );
      return { requiresTwoFactor: true, twoFactorToken };
    }

    await this.prisma.client.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });
    this.events.emit(ADMIN_LOGGED_IN_EVENT, {
      adminUserId: admin.id,
    } satisfies AdminLoggedInEvent);
    return this.tokens.signAdminTokens(admin.id);
  }

  async verifyTwoFactor(dto: TwoFactorVerifyDto): Promise<TokenPair> {
    const { sub: adminUserId } =
      await this.tokens.verifyAdminTwoFactorPendingToken(dto.twoFactorToken);
    const admin = await this.prisma.client.adminUser.findUniqueOrThrow({
      where: { id: adminUserId },
    });

    await this.otp.verify(admin.email, dto.code, 'ADMIN_LOGIN');

    await this.prisma.client.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });
    this.events.emit(ADMIN_LOGGED_IN_EVENT, {
      adminUserId: admin.id,
    } satisfies AdminLoggedInEvent);
    return this.tokens.signAdminTokens(admin.id);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const payload = await this.tokens.verifyAdminRefreshToken(refreshToken);
    return this.tokens.signAdminTokens(payload.sub);
  }

  async me(adminUserId: number): Promise<AdminProfileDto> {
    const admin = await this.prisma.client.adminUser.findUniqueOrThrow({
      where: { id: adminUserId },
    });
    return toAdminProfileDto(admin);
  }

  async changeOwnPassword(
    adminUserId: number,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const admin = await this.prisma.client.adminUser.findUniqueOrThrow({
      where: { id: adminUserId },
    });
    if (!(await verifyPassword(currentPassword, admin.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    const passwordHash = await hashPassword(newPassword);
    await this.prisma.client.adminUser.update({
      where: { id: adminUserId },
      data: { passwordHash },
    });
  }

  async setupTwoFactor(email: string): Promise<void> {
    await this.otp.request(email, 'ADMIN_LOGIN');
  }

  async enableTwoFactor(
    adminUserId: number,
    dto: TwoFactorEnableDto,
  ): Promise<void> {
    const admin = await this.prisma.client.adminUser.findUniqueOrThrow({
      where: { id: adminUserId },
    });
    await this.otp.verify(admin.email, dto.code, 'ADMIN_LOGIN');
    await this.prisma.client.adminUser.update({
      where: { id: adminUserId },
      data: { twoFactorEnabled: true },
    });
  }

  async disableTwoFactor(adminUserId: number): Promise<void> {
    await this.prisma.client.adminUser.update({
      where: { id: adminUserId },
      data: { twoFactorEnabled: false },
    });
  }
}
