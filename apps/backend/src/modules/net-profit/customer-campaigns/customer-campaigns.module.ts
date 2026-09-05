import { Module } from '@nestjs/common';
import { NetProfitSettingsModule } from '../settings/net-profit-settings.module';
import { SmsModule } from '../sms/sms.module';
import { EmailSettingsModule } from '../../email-settings/email-settings.module';
import { AdminCustomerCampaignsController } from './admin-customer-campaigns.controller';
import { CustomerCampaignsService } from './customer-campaigns.service';
import { SmtpEmailProvider } from '../cart-campaigns/providers/smtp-email.provider';

@Module({
  imports: [NetProfitSettingsModule, SmsModule, EmailSettingsModule],
  controllers: [AdminCustomerCampaignsController],
  // SmtpEmailProvider is re-provided rather than imported from
  // CartCampaignsModule: that module does not export it, and importing the
  // whole cart engine just to borrow a mailer would drag its cron worker in
  // as a dependency of this one.
  providers: [CustomerCampaignsService, SmtpEmailProvider],
  // CustomersService triggers the welcome sequence through this.
  exports: [CustomerCampaignsService],
})
export class CustomerCampaignsModule {}
