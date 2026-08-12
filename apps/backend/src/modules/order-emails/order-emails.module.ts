import { Module } from '@nestjs/common';
import { EmailTemplatesModule } from '../email-templates/email-templates.module';
import { EmailSettingsModule } from '../email-settings/email-settings.module';
import { SmtpEmailProvider } from '../net-profit/cart-campaigns/providers/smtp-email.provider';
import { OrderEmailsService } from './order-emails.service';

@Module({
  imports: [EmailTemplatesModule, EmailSettingsModule],
  // SmtpEmailProvider is stateless — re-provided here rather than importing
  // the whole CartCampaignsModule for one class, same pattern OrdersModule
  // already used for it.
  providers: [OrderEmailsService, SmtpEmailProvider],
  exports: [OrderEmailsService],
})
export class OrderEmailsModule {}
