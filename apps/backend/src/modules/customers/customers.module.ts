import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomerAddressesController } from './customer-addresses.controller';
import { WishlistController } from './wishlist.controller';
import { CustomersService } from './customers.service';
import { WishlistService } from './wishlist.service';

@Module({
  controllers: [
    CustomersController,
    CustomerAddressesController,
    WishlistController,
  ],
  providers: [CustomersService, WishlistService],
})
export class CustomersModule {}
