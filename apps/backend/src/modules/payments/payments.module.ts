import { Module } from '@nestjs/common';
import { CredentialsModule } from '../../common/credentials/credentials.module';
import { DigitalProductsModule } from '../digital-products/digital-products.module';
import { OrderEmailsModule } from '../order-emails/order-emails.module';
import { AccountsModule } from '../net-profit/accounts/accounts.module';
import { PaymentsService } from './payments.service';
import { CodPaymentProvider } from './providers/cod-payment.provider';
import { ManualPaymentProvider } from './providers/manual-payment.provider';
import { BkashSettingsService } from './bkash/bkash-settings.service';
import { BkashPaymentProvider } from './bkash/bkash-payment.provider';
import { BkashCallbackService } from './bkash/bkash-callback.service';
import { BkashCallbackController } from './bkash/bkash-callback.controller';
import { AdminBkashSettingsController } from './bkash/admin-bkash-settings.controller';

@Module({
  // AccountsModule: refunds post to the ledger.
  // AccountsModule: refunds and bKash captures post to the ledger.
  // DigitalProductsModule: a captured bKash payment releases digital files.
  imports: [AccountsModule, CredentialsModule, DigitalProductsModule, OrderEmailsModule],
  controllers: [BkashCallbackController, AdminBkashSettingsController],
  providers: [
    PaymentsService,
    CodPaymentProvider,
    ManualPaymentProvider,
    BkashSettingsService,
    BkashPaymentProvider,
    BkashCallbackService,
  ],
  exports: [PaymentsService, BkashSettingsService],
})
export class PaymentsModule {}
