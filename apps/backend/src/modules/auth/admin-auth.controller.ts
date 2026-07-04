import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { CurrentAdmin } from '../../common/auth/current-admin.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { TwoFactorVerifyDto } from './dto/two-factor-verify.dto';
import { TwoFactorEnableDto } from './dto/two-factor-enable.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('admin/auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuth: AdminAuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  login(@Body() dto: AdminLoginDto, @Req() req: Request) {
    return this.adminAuth.login(dto, req.ip, req.headers['user-agent']);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('2fa/verify')
  verifyTwoFactor(@Body() dto: TwoFactorVerifyDto) {
    return this.adminAuth.verifyTwoFactor(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.adminAuth.refresh(dto.refreshToken);
  }

  @ApiBearerAuth()
  @UseGuards(AdminJwtGuard)
  @Get('me')
  me(@CurrentAdmin() admin: { id: number }) {
    return this.adminAuth.me(admin.id);
  }

  @ApiBearerAuth()
  @UseGuards(AdminJwtGuard)
  @UseInterceptors(AuditLogInterceptor)
  @Post('change-password')
  changePassword(
    @CurrentAdmin() admin: { id: number },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.adminAuth.changeOwnPassword(
      admin.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @ApiBearerAuth()
  @UseGuards(AdminJwtGuard)
  @UseInterceptors(AuditLogInterceptor)
  @Post('2fa/setup')
  async setupTwoFactor(@CurrentAdmin() admin: { id: number }) {
    const profile = await this.adminAuth.me(admin.id);
    return this.adminAuth.setupTwoFactor(admin.id, profile.email);
  }

  @ApiBearerAuth()
  @UseGuards(AdminJwtGuard)
  @UseInterceptors(AuditLogInterceptor)
  @Post('2fa/enable')
  enableTwoFactor(
    @CurrentAdmin() admin: { id: number },
    @Body() dto: TwoFactorEnableDto,
  ) {
    return this.adminAuth.enableTwoFactor(admin.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AdminJwtGuard)
  @UseInterceptors(AuditLogInterceptor)
  @Post('2fa/disable')
  disableTwoFactor(@CurrentAdmin() admin: { id: number }) {
    return this.adminAuth.disableTwoFactor(admin.id);
  }
}
