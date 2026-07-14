import { Module } from '@nestjs/common';
import { AdminAdvancePaymentController } from './admin-advance-payment.controller';
import { AdvancePaymentService } from './advance-payment.service';

@Module({
  controllers: [AdminAdvancePaymentController],
  providers: [AdvancePaymentService],
  exports: [AdvancePaymentService],
})
export class AdvancePaymentModule {}
