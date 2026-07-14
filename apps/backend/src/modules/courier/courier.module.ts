import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { AdminShipmentsController } from './admin-shipments.controller';
import { AdminCourierSettingsController } from './admin-courier-settings.controller';
import { CourierWebhooksController } from './courier-webhooks.controller';
import { ShipmentsService } from './shipments.service';
import { ShippingChargeCalculator } from './shipping-charge.calculator';
import { CourierSettingsService } from './courier-settings.service';
import { SteadfastCourierProvider } from './providers/steadfast-courier.provider';
import { PathaoCourierProvider } from './providers/pathao-courier.provider';
import { RedxCourierProvider } from './providers/redx-courier.provider';

@Module({
  imports: [OrdersModule],
  controllers: [AdminShipmentsController, AdminCourierSettingsController, CourierWebhooksController],
  providers: [
    ShipmentsService,
    ShippingChargeCalculator,
    CourierSettingsService,
    SteadfastCourierProvider,
    PathaoCourierProvider,
    RedxCourierProvider,
  ],
  // Net Profit Order Manager (§7.8/M2) bulk-consigns through the real
  // ShipmentsService rather than a second courier client.
  exports: [ShipmentsService],
})
export class CourierModule {}
