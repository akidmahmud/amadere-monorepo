import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RecoveryModule } from '../net-profit/recovery/recovery.module';
import { ShippingZonesModule } from '../shipping-zones/shipping-zones.module';
import { ShippingRulesModule } from '../shipping-rules/shipping-rules.module';
import { CartModule } from '../cart/cart.module';
import { PaymentsModule } from '../payments/payments.module';
import { FraudModule } from '../net-profit/fraud/fraud.module';
import { BlockerModule } from '../net-profit/blocker/blocker.module';
import { AdvancePaymentModule } from '../net-profit/advance-payment/advance-payment.module';
import { OtpSecurityModule } from '../net-profit/otp-security/otp-security.module';
import { SmsModule } from '../net-profit/sms/sms.module';
import { NetProfitSettingsModule } from '../net-profit/settings/net-profit-settings.module';
import { EmailSettingsModule } from '../email-settings/email-settings.module';
import { EmailTemplatesModule } from '../email-templates/email-templates.module';
import { SettingsModule } from '../settings/settings.module';
import { CustomersModule } from '../customers/customers.module';
import { OrderEmailsModule } from '../order-emails/order-emails.module';
import { DigitalProductsModule } from '../digital-products/digital-products.module';
import { CheckoutController } from './checkout.controller';
import { OrdersController } from './orders.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { CheckoutService } from './checkout.service';
import { CheckoutAccountService } from './checkout-account.service';
import { OrdersService } from './orders.service';
import { AdminOrderCreationService } from './admin-order-creation.service';

@Module({
  imports: [CartModule, PaymentsModule, FraudModule, BlockerModule, AdvancePaymentModule, OtpSecurityModule, SmsModule, NetProfitSettingsModule, EmailSettingsModule, EmailTemplatesModule, SettingsModule, CustomersModule, OrderEmailsModule, ShippingZonesModule, ShippingRulesModule, DigitalProductsModule, RecoveryModule, AuthModule],
  controllers: [CheckoutController, OrdersController, AdminOrdersController],
  providers: [CheckoutService, CheckoutAccountService, OrdersService, AdminOrderCreationService],
  exports: [OrdersService],
})
export class OrdersModule {}
