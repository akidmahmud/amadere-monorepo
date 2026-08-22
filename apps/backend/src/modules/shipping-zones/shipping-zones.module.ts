import { Module } from '@nestjs/common';
import { AdminShippingZonesController } from './admin-shipping-zones.controller';
import { ShippingZonesController } from './shipping-zones.controller';
import { ShippingZonesService } from './shipping-zones.service';

@Module({
  controllers: [ShippingZonesController, AdminShippingZonesController],
  providers: [ShippingZonesService],
  // CartService and CheckoutService resolve the fee through this service, so
  // it has to leave the module.
  exports: [ShippingZonesService],
})
export class ShippingZonesModule {}
