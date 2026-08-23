import { Module } from '@nestjs/common';
import { AdvancePaymentModule } from '../advance-payment/advance-payment.module';
import { MediaModule } from '../../media/media.module';
import { OrderEmailsModule } from '../../order-emails/order-emails.module';
import { DigitalProductsModule } from '../../digital-products/digital-products.module';
import { AccountsModule } from '../accounts/accounts.module';
import { AdminManualPaymentController } from './admin-manual-payment.controller';
import { ManualPaymentPublicController } from './manual-payment.public.controller';
import { ManualPaymentService } from './manual-payment.service';

@Module({
  // AccountsModule: a verified submission is where prepaid money becomes
  // ours, so that is where it posts to the ledger.
  imports: [AdvancePaymentModule, MediaModule, OrderEmailsModule, DigitalProductsModule, AccountsModule],
  controllers: [AdminManualPaymentController, ManualPaymentPublicController],
  providers: [ManualPaymentService],
})
export class ManualPaymentModule {}
