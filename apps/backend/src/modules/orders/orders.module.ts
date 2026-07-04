import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { PaymentsModule } from '../payments/payments.module';
import { CheckoutController } from './checkout.controller';
import { OrdersController } from './orders.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { CheckoutService } from './checkout.service';
import { OrdersService } from './orders.service';

@Module({
  imports: [CartModule, PaymentsModule],
  controllers: [CheckoutController, OrdersController, AdminOrdersController],
  providers: [CheckoutService, OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
