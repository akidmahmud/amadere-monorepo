import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { AdminShipmentsController } from './admin-shipments.controller';
import { CourierWebhooksController } from './courier-webhooks.controller';
import { ShipmentsService } from './shipments.service';
import { ShippingChargeCalculator } from './shipping-charge.calculator';
import { SteadfastCourierProvider } from './providers/steadfast-courier.provider';

@Module({
  imports: [OrdersModule],
  controllers: [AdminShipmentsController, CourierWebhooksController],
  providers: [
    ShipmentsService,
    ShippingChargeCalculator,
    SteadfastCourierProvider,
  ],
})
export class CourierModule {}
