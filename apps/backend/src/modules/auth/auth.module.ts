import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AdminAuthController } from './admin-auth.controller';
import { CustomerAuthService } from './customer-auth.service';
import { AdminAuthService } from './admin-auth.service';
import { OtpService } from './otp.service';
import { OTP_NOTIFIER } from './notification/otp-notifier.interface';
import { SmsOtpNotifier } from './notification/sms-otp-notifier';
import { SOCIAL_LOGIN_VERIFIER } from './notification/social-login-verifier.interface';
import { GoogleSocialLoginVerifier } from './notification/google-social-login-verifier';
import { SmsModule } from '../net-profit/sms/sms.module';
import { SmtpEmailProvider } from '../net-profit/cart-campaigns/providers/smtp-email.provider';

@Module({
  imports: [SmsModule],
  controllers: [AuthController, AdminAuthController],
  providers: [
    CustomerAuthService,
    AdminAuthService,
    OtpService,
    SmtpEmailProvider,
    { provide: OTP_NOTIFIER, useClass: SmsOtpNotifier },
    {
      provide: SOCIAL_LOGIN_VERIFIER,
      useClass: GoogleSocialLoginVerifier,
    },
  ],
})
export class AuthModule {}
