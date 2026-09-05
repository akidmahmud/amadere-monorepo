import { Module } from '@nestjs/common';
import { NetProfitSettingsModule } from '../settings/net-profit-settings.module';
import { SmsModule } from '../sms/sms.module';
import { CartCampaignsModule } from '../cart-campaigns/cart-campaigns.module';
import { MergeTagsModule } from '../merge-tags/merge-tags.module';
import { DigitalProductsModule } from '../../digital-products/digital-products.module';
import { SettingsModule } from '../../settings/settings.module';
import { WhatsappModule } from '../../whatsapp/whatsapp.module';
import { EmailSettingsModule } from '../../email-settings/email-settings.module';
import { SmtpEmailProvider } from '../cart-campaigns/providers/smtp-email.provider';
import { AdminRecoveryController } from './admin-recovery.controller';
import { RecoveryService } from './recovery.service';

@Module({
  imports: [NetProfitSettingsModule, SmsModule, CartCampaignsModule, MergeTagsModule, DigitalProductsModule, SettingsModule, WhatsappModule, EmailSettingsModule],
  controllers: [AdminRecoveryController],
  providers: [RecoveryService, SmtpEmailProvider],
  // CheckoutService records the checkout/OTP abandonment stages through it.
  exports: [RecoveryService],
})
export class RecoveryModule {}
