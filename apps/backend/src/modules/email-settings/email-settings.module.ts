import { Module } from '@nestjs/common';
import { AdminEmailSettingsController } from './admin-email-settings.controller';
import { EmailSettingsService } from './email-settings.service';
import { SmtpEmailProvider } from '../net-profit/cart-campaigns/providers/smtp-email.provider';

@Module({
  controllers: [AdminEmailSettingsController],
  providers: [EmailSettingsService, SmtpEmailProvider],
  exports: [EmailSettingsService],
})
export class EmailSettingsModule {}
