import { Module } from '@nestjs/common';
import { AdvancePaymentModule } from '../advance-payment/advance-payment.module';
import { AdminManualPaymentController } from './admin-manual-payment.controller';
import { ManualPaymentPublicController } from './manual-payment.public.controller';
import { ManualPaymentService } from './manual-payment.service';

@Module({
  imports: [AdvancePaymentModule],
  controllers: [AdminManualPaymentController, ManualPaymentPublicController],
  providers: [ManualPaymentService],
})
export class ManualPaymentModule {}
