import { Module } from '@nestjs/common';
import { NetProfitSettingsModule } from '../net-profit/settings/net-profit-settings.module';
import { UpsellBarModule } from '../upsell-bar/upsell-bar.module';
import { ShippingZonesModule } from '../shipping-zones/shipping-zones.module';
import { ShippingRulesModule } from '../shipping-rules/shipping-rules.module';
import { CartController, CartMergeController } from './cart.controller';
import { CartService } from './cart.service';
import { PricingService } from './pricing.service';
import { CartIdentityGuard } from './cart-identity.guard';

@Module({
  imports: [NetProfitSettingsModule, UpsellBarModule, ShippingZonesModule, ShippingRulesModule],
  controllers: [CartController, CartMergeController],
  providers: [CartService, PricingService, CartIdentityGuard],
  // CartService is exported for OrdersService.restoreCartFromPayment, which
  // puts a cancelled-gateway-payment order's lines back in the customer's
  // cart through the same validated add path a normal add-to-cart uses.
  exports: [CartService, PricingService, CartIdentityGuard],
})
export class CartModule {}
