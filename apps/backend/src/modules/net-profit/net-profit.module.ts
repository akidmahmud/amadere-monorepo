import { Module } from '@nestjs/common';
import { NetProfitSettingsModule } from './settings/net-profit-settings.module';
import { FraudModule } from './fraud/fraud.module';
import { BlockerModule } from './blocker/blocker.module';
import { OrderManagerModule } from './order-manager/order-manager.module';
import { SmsModule } from './sms/sms.module';
import { AdvancePaymentModule } from './advance-payment/advance-payment.module';
import { ManualPaymentModule } from './manual-payment/manual-payment.module';
import { RecoveryModule } from './recovery/recovery.module';
import { ProfitModule } from './profit/profit.module';
import { SalesReportModule } from './sales-report/sales-report.module';
import { OverviewModule } from './overview/overview.module';
import { OtpSecurityModule } from './otp-security/otp-security.module';
import { PaymentMethodConfigModule } from './payment-method-config/payment-method-config.module';
import { OrderStatusesModule } from './order-statuses/order-statuses.module';
import { CartCampaignsModule } from './cart-campaigns/cart-campaigns.module';
import { MarketingCostModule } from './marketing-cost/marketing-cost.module';
import { CleanupModule } from './cleanup/cleanup.module';
import { AccountsModule } from './accounts/accounts.module';

// One module for the whole Net Profit section (CLAUDE.net-profit.md §2) —
// imports one sub-module per feature (fraud, sms, advance-payment, ...) as
// each ships. Exports nothing outside; sub-modules that other Amader
// modules need to reach (e.g. orders' checkout gate) export their service
// directly, imported by name, not through this umbrella.
@Module({
  imports: [
    NetProfitSettingsModule,
    FraudModule,
    BlockerModule,
    OrderManagerModule,
    SmsModule,
    AdvancePaymentModule,
    ManualPaymentModule,
    RecoveryModule,
    ProfitModule,
    SalesReportModule,
    OverviewModule,
    OtpSecurityModule,
    PaymentMethodConfigModule,
    OrderStatusesModule,
    CartCampaignsModule,
    MarketingCostModule,
    CleanupModule,
    AccountsModule,
  ],
})
export class NetProfitModule {}
