import { Module } from '@nestjs/common';
import { StockModule } from '../stock/stock.module';
import { StoresModule } from '../stores/stores.module';
import { AdminPosController } from './admin-pos.controller';
import { PosCatalogService } from './pos-catalog.service';
import { PosSaleService } from './pos-sale.service';
import { PosSettingsService } from './pos-settings.service';
import { PosInvoiceService } from './pos-invoice.service';
import { PosReportsService } from './pos-reports.service';
import { CartModule } from '../cart/cart.module';
import { PaymentsModule } from '../payments/payments.module';
import { AccountsModule } from '../net-profit/accounts/accounts.module';

@Module({
  imports: [
    StockModule,
    StoresModule,
    CartModule,
    PaymentsModule,
    AccountsModule,
  ],
  controllers: [AdminPosController],
  providers: [
    PosCatalogService,
    PosSaleService,
    PosReportsService,
    PosSettingsService,
    PosInvoiceService,
  ],
})
export class PosModule {}
