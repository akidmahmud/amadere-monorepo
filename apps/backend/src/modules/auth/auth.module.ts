import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AdminAuthController } from './admin-auth.controller';
import { CustomerAuthService } from './customer-auth.service';
import { AdminAuthService } from './admin-auth.service';
import { OtpService } from './otp.service';
import { OTP_NOTIFIER } from './notification/otp-notifier.interface';
import { ConsoleOtpNotifier } from './notification/console-otp-notifier';
import { SOCIAL_LOGIN_VERIFIER } from './notification/social-login-verifier.interface';
import { UnconfiguredSocialLoginVerifier } from './notification/unconfigured-social-login-verifier';

@Module({
  controllers: [AuthController, AdminAuthController],
  providers: [
    CustomerAuthService,
    AdminAuthService,
    OtpService,
    { provide: OTP_NOTIFIER, useClass: ConsoleOtpNotifier },
    {
      provide: SOCIAL_LOGIN_VERIFIER,
      useClass: UnconfiguredSocialLoginVerifier,
    },
  ],
})
export class AuthModule {}
