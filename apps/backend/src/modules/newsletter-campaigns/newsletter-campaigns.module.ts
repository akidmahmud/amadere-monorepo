import { Module } from '@nestjs/common';
import { EmailSettingsModule } from '../email-settings/email-settings.module';
import { NewsletterSegmentsModule } from '../newsletter-segments/newsletter-segments.module';
import { SmtpEmailProvider } from '../net-profit/cart-campaigns/providers/smtp-email.provider';
import { AdminNewsletterCampaignsController } from './admin-newsletter-campaigns.controller';
import { NewsletterCampaignsPublicController } from './newsletter-campaigns-public.controller';
import { NewsletterCampaignsService } from './newsletter-campaigns.service';

@Module({
  imports: [EmailSettingsModule, NewsletterSegmentsModule],
  controllers: [AdminNewsletterCampaignsController, NewsletterCampaignsPublicController],
  providers: [NewsletterCampaignsService, SmtpEmailProvider],
  exports: [NewsletterCampaignsService],
})
export class NewsletterCampaignsModule {}
