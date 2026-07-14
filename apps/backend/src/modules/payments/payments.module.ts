import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CodPaymentProvider } from './providers/cod-payment.provider';
import { ManualPaymentProvider } from './providers/manual-payment.provider';

@Module({
  providers: [PaymentsService, CodPaymentProvider, ManualPaymentProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}
