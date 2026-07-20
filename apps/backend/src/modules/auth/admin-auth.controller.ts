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
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { TokenPair } from '../../common/auth/token.types';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { CurrentAdmin } from '../../common/auth/current-admin.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { AdminAuthService, AdminLoginResult } from './admin-auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { TwoFactorVerifyDto } from './dto/two-factor-verify.dto';
import { TwoFactorEnableDto } from './dto/two-factor-enable.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AdminProfileDto, AdminTwoFactorRequiredDto } from './admin.mapper';

@ApiTags('admin/auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuth: AdminAuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @ApiExtraModels(TokenPair, AdminTwoFactorRequiredDto)
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(TokenPair) },
        { $ref: getSchemaPath(AdminTwoFactorRequiredDto) },
      ],
    },
  })
  login(
    @Body() dto: AdminLoginDto,
    @Req() req: Request,
  ): Promise<AdminLoginResult> {
    return this.adminAuth.login(dto, req.ip, req.headers['user-agent']);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('2fa/verify')
  @ApiOkResponse({ type: TokenPair })
  verifyTwoFactor(@Body() dto: TwoFactorVerifyDto): Promise<TokenPair> {
    return this.adminAuth.verifyTwoFactor(dto);
  }

  @Post('refresh')
  @ApiOkResponse({ type: TokenPair })
  refresh(@Body() dto: RefreshTokenDto): Promise<TokenPair> {
    return this.adminAuth.refresh(dto.refreshToken);
  }

  @ApiBearerAuth()
  @UseGuards(AdminJwtGuard)
  @Get('me')
  @ApiOkResponse({ type: AdminProfileDto })
  me(@CurrentAdmin() admin: { id: number }): Promise<AdminProfileDto> {
    return this.adminAuth.me(admin.id);
  }

  @ApiBearerAuth()
  @UseGuards(AdminJwtGuard)
  @UseInterceptors(AuditLogInterceptor)
  @Post('change-password')
  changePassword(
    @CurrentAdmin() admin: { id: number },
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.adminAuth.changeOwnPassword(
      admin.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  // Sends a verification code to the admin's own account email — "setup"
  // for email-OTP 2FA just means proving you can receive it (no secret/QR
  // code involved, unlike TOTP).
  @ApiBearerAuth()
  @UseGuards(AdminJwtGuard)
  @UseInterceptors(AuditLogInterceptor)
  @Post('2fa/setup')
  async setupTwoFactor(@CurrentAdmin() admin: { id: number }): Promise<void> {
    const profile = await this.adminAuth.me(admin.id);
    return this.adminAuth.setupTwoFactor(profile.email);
  }

  @ApiBearerAuth()
  @UseGuards(AdminJwtGuard)
  @UseInterceptors(AuditLogInterceptor)
  @Post('2fa/enable')
  enableTwoFactor(
    @CurrentAdmin() admin: { id: number },
    @Body() dto: TwoFactorEnableDto,
  ): Promise<void> {
    return this.adminAuth.enableTwoFactor(admin.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AdminJwtGuard)
  @UseInterceptors(AuditLogInterceptor)
  @Post('2fa/disable')
  disableTwoFactor(@CurrentAdmin() admin: { id: number }): Promise<void> {
    return this.adminAuth.disableTwoFactor(admin.id);
  }
}
