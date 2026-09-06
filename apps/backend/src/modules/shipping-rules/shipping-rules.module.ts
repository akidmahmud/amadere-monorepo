import { Module } from '@nestjs/common';
import { AdminShippingRulesController } from './admin-shipping-rules.controller';
import { ShippingRulesService } from './shipping-rules.service';
import { ShippingZonesModule } from '../shipping-zones/shipping-zones.module';
import { ShippingRulesController } from './shipping-rules.controller';

@Module({
  imports: [ShippingZonesModule],
  controllers: [AdminShippingRulesController, ShippingRulesController],
  providers: [ShippingRulesService],
  // CartService and CheckoutService resolve the toggled-on checkout fee
  // through this service.
  exports: [ShippingRulesService],
})
export class ShippingRulesModule {}
