import { Module } from '@nestjs/common';
import { CartController, CartMergeController } from './cart.controller';
import { CartService } from './cart.service';
import { PricingService } from './pricing.service';
import { CartIdentityGuard } from './cart-identity.guard';

@Module({
  controllers: [CartController, CartMergeController],
  providers: [CartService, PricingService, CartIdentityGuard],
  exports: [PricingService, CartIdentityGuard],
})
export class CartModule {}
