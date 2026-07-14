import { Module } from '@nestjs/common';
import { NetProfitSettingsModule } from '../settings/net-profit-settings.module';
import { SmsModule } from '../sms/sms.module';
import { CartCampaignsModule } from '../cart-campaigns/cart-campaigns.module';
import { AdminRecoveryController } from './admin-recovery.controller';
import { RecoveryService } from './recovery.service';

@Module({
  imports: [NetProfitSettingsModule, SmsModule, CartCampaignsModule],
  controllers: [AdminRecoveryController],
  providers: [RecoveryService],
})
export class RecoveryModule {}
