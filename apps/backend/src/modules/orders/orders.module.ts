import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { PaymentsModule } from '../payments/payments.module';
import { FraudModule } from '../net-profit/fraud/fraud.module';
import { BlockerModule } from '../net-profit/blocker/blocker.module';
import { AdvancePaymentModule } from '../net-profit/advance-payment/advance-payment.module';
import { OtpSecurityModule } from '../net-profit/otp-security/otp-security.module';
import { SmsModule } from '../net-profit/sms/sms.module';
import { NetProfitSettingsModule } from '../net-profit/settings/net-profit-settings.module';
import { EmailSettingsModule } from '../email-settings/email-settings.module';
import { CustomersModule } from '../customers/customers.module';
import { OrderEmailsModule } from '../order-emails/order-emails.module';
import { CheckoutController } from './checkout.controller';
import { OrdersController } from './orders.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { CheckoutService } from './checkout.service';
import { OrdersService } from './orders.service';
import { AdminOrderCreationService } from './admin-order-creation.service';

@Module({
  imports: [CartModule, PaymentsModule, FraudModule, BlockerModule, AdvancePaymentModule, OtpSecurityModule, SmsModule, NetProfitSettingsModule, EmailSettingsModule, CustomersModule, OrderEmailsModule],
  controllers: [CheckoutController, OrdersController, AdminOrdersController],
  providers: [CheckoutService, OrdersService, AdminOrderCreationService],
  exports: [OrdersService],
})
export class OrdersModule {}
