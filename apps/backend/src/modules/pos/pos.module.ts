import { PosTiersService } from './pos-tiers.service';
import { PosSmsService } from './pos-sms.service';
import { SmsModule } from '../net-profit/sms/sms.module';
import { PosManagerService } from './pos-manager.service';
import { PosStoresService } from './pos-stores.service';
import { ProductsModule } from '../products/products.module';
import { PosProductsService } from './pos-products.service';
import { Module } from '@nestjs/common';
import { StockModule } from '../stock/stock.module';
import { StoresModule } from '../stores/stores.module';
import { AdminPosController } from './admin-pos.controller';
import { PosCatalogService } from './pos-catalog.service';
import { PosSaleService } from './pos-sale.service';
import { PosSettingsService } from './pos-settings.service';
import { PosInvoiceService } from './pos-invoice.service';
import { PosCouponsService } from './pos-coupons.service';
import { PosReportsService } from './pos-reports.service';
import { CartModule } from '../cart/cart.module';
import { PaymentsModule } from '../payments/payments.module';
import { AccountsModule } from '../net-profit/accounts/accounts.module';
import { PosExpensesService } from './pos-expenses.service';
import { ProductCostHistoryModule } from '../product-cost-history/product-cost-history.module';

@Module({
  imports: [
    StockModule,
    StoresModule,
    CartModule,
    PaymentsModule,
    AccountsModule,
    ProductsModule,
    SmsModule,
    ProductCostHistoryModule,
  ],
  controllers: [AdminPosController],
  providers: [
    PosCatalogService,
    PosSaleService,
    PosReportsService,
    PosSettingsService,
    PosInvoiceService,
    PosCouponsService,
    PosProductsService,
    PosStoresService,
    PosManagerService,
    PosTiersService,
    PosSmsService,
    PosExpensesService,
  ],
})
export class PosModule {}
