import { Module } from '@nestjs/common';
import { AdminShippingRulesController } from './admin-shipping-rules.controller';
import { ShippingRulesService } from './shipping-rules.service';

@Module({
  controllers: [AdminShippingRulesController],
  providers: [ShippingRulesService],
  // CartService and CheckoutService resolve the toggled-on checkout fee
  // through this service.
  exports: [ShippingRulesService],
})
export class ShippingRulesModule {}
