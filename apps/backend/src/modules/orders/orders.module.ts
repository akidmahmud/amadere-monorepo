import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { PaymentsModule } from '../payments/payments.module';
import { FraudModule } from '../net-profit/fraud/fraud.module';
import { BlockerModule } from '../net-profit/blocker/blocker.module';
import { AdvancePaymentModule } from '../net-profit/advance-payment/advance-payment.module';
import { OtpSecurityModule } from '../net-profit/otp-security/otp-security.module';
import { SmsModule } from '../net-profit/sms/sms.module';
import { CustomersModule } from '../customers/customers.module';
import { SmtpEmailProvider } from '../net-profit/cart-campaigns/providers/smtp-email.provider';
import { CheckoutController } from './checkout.controller';
import { OrdersController } from './orders.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { CheckoutService } from './checkout.service';
import { OrdersService } from './orders.service';
import { AdminOrderCreationService } from './admin-order-creation.service';

@Module({
  imports: [CartModule, PaymentsModule, FraudModule, BlockerModule, AdvancePaymentModule, OtpSecurityModule, SmsModule, CustomersModule],
  controllers: [CheckoutController, OrdersController, AdminOrdersController],
  // SmtpEmailProvider is stateless (just ConfigService) — re-provided here
  // rather than importing the whole CartCampaignsModule for one class.
  providers: [CheckoutService, OrdersService, AdminOrderCreationService, SmtpEmailProvider],
  exports: [OrdersService],
})
export class OrdersModule {}
