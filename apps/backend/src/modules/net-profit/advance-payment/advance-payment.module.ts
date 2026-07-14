import { Module } from '@nestjs/common';
import { NetProfitSettingsModule } from '../settings/net-profit-settings.module';
import { AdminAdvancePaymentController } from './admin-advance-payment.controller';
import { AdvancePaymentService } from './advance-payment.service';

@Module({
  imports: [NetProfitSettingsModule],
  controllers: [AdminAdvancePaymentController],
  providers: [AdvancePaymentService],
  exports: [AdvancePaymentService],
})
export class AdvancePaymentModule {}
