import { Module } from '@nestjs/common';
import { AccountsModule } from '../net-profit/accounts/accounts.module';
import { ProductsModule } from '../products/products.module';
import { AdminWholesaleController } from './admin-wholesale.controller';
import { WholesaleService } from './wholesale.service';

// Admin-only: wholesale is placed by staff at the counter, never by a
// storefront visitor, so there is deliberately no public controller.
//
// AccountsModule is imported rather than reimplemented — LedgerService is the
// only code permitted to write a ledger entry, and DuesService already owns
// "never collect more than is outstanding" and period locking.
@Module({
  imports: [AccountsModule, ProductsModule],
  controllers: [AdminWholesaleController],
  providers: [WholesaleService],
  exports: [WholesaleService],
})
export class WholesaleModule {}
