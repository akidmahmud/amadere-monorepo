import { Module } from '@nestjs/common';
import { AccountsModule } from '../net-profit/accounts/accounts.module';
import { PaymentsService } from './payments.service';
import { CodPaymentProvider } from './providers/cod-payment.provider';
import { ManualPaymentProvider } from './providers/manual-payment.provider';

@Module({
  // AccountsModule: refunds post to the ledger.
  imports: [AccountsModule],
  providers: [PaymentsService, CodPaymentProvider, ManualPaymentProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}
