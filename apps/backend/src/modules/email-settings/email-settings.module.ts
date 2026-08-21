import { Module } from '@nestjs/common';
import { AdminEmailSettingsController } from './admin-email-settings.controller';
import { EmailSettingsService } from './email-settings.service';
import { SmtpEmailProvider } from '../net-profit/cart-campaigns/providers/smtp-email.provider';

@Module({
  controllers: [AdminEmailSettingsController],
  providers: [EmailSettingsService, SmtpEmailProvider],
  // SmtpEmailProvider is exported (not just provided) so CheckoutService can
  // deliver the COD verification code by email when the customer picks that
  // channel — same provider the auth OTP notifier already uses.
  exports: [EmailSettingsService, SmtpEmailProvider],
})
export class EmailSettingsModule {}
