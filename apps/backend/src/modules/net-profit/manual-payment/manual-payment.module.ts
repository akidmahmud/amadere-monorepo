import { Module } from '@nestjs/common';
import { AdvancePaymentModule } from '../advance-payment/advance-payment.module';
import { MediaModule } from '../../media/media.module';
import { OrderEmailsModule } from '../../order-emails/order-emails.module';
import { AdminManualPaymentController } from './admin-manual-payment.controller';
import { ManualPaymentPublicController } from './manual-payment.public.controller';
import { ManualPaymentService } from './manual-payment.service';

@Module({
  imports: [AdvancePaymentModule, MediaModule, OrderEmailsModule],
  controllers: [AdminManualPaymentController, ManualPaymentPublicController],
  providers: [ManualPaymentService],
})
export class ManualPaymentModule {}
