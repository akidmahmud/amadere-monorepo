import { Module } from '@nestjs/common';
import { NetProfitSettingsModule } from '../settings/net-profit-settings.module';
import { SmsModule } from '../sms/sms.module';
import { MergeTagsModule } from '../merge-tags/merge-tags.module';
import { AdminCartCampaignsController } from './admin-cart-campaigns.controller';
import { CartCampaignsService } from './cart-campaigns.service';
import { SmtpEmailProvider } from './providers/smtp-email.provider';

@Module({
  imports: [NetProfitSettingsModule, SmsModule, MergeTagsModule],
  controllers: [AdminCartCampaignsController],
  providers: [CartCampaignsService, SmtpEmailProvider],
  exports: [CartCampaignsService],
})
export class CartCampaignsModule {}
