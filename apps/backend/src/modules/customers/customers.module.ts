import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomerAddressesController } from './customer-addresses.controller';
import { WishlistController } from './wishlist.controller';
import { AdminCustomerTiersController } from './admin-customer-tiers.controller';
import { AdminCustomersController } from './admin-customers.controller';
import { CustomersService } from './customers.service';
import { WishlistService } from './wishlist.service';
import { CustomerTiersService } from './customer-tiers.service';
import { CustomerOrderEventListener } from './customer-order-event.listener';
import { CALL_PROVIDER } from './providers/call-provider.interface';
import { UnconfiguredCallProvider } from './providers/unconfigured-call-provider';

@Module({
  controllers: [
    CustomersController,
    CustomerAddressesController,
    WishlistController,
    AdminCustomerTiersController,
    AdminCustomersController,
  ],
  providers: [
    CustomersService,
    WishlistService,
    CustomerTiersService,
    CustomerOrderEventListener,
    { provide: CALL_PROVIDER, useClass: UnconfiguredCallProvider },
  ],
  exports: [CustomerTiersService],
})
export class CustomersModule {}
