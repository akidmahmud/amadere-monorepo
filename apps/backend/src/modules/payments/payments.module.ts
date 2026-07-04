import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CodPaymentProvider } from './providers/cod-payment.provider';

@Module({
  providers: [PaymentsService, CodPaymentProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}
