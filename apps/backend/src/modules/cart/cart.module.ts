import { Module } from '@nestjs/common';
import { NetProfitSettingsModule } from '../net-profit/settings/net-profit-settings.module';
import { CartController, CartMergeController } from './cart.controller';
import { CartService } from './cart.service';
import { PricingService } from './pricing.service';
import { CartIdentityGuard } from './cart-identity.guard';

@Module({
  imports: [NetProfitSettingsModule],
  controllers: [CartController, CartMergeController],
  providers: [CartService, PricingService, CartIdentityGuard],
  exports: [PricingService, CartIdentityGuard],
})
export class CartModule {}
