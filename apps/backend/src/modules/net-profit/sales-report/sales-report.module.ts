import { Module } from '@nestjs/common';
import { ProfitModule } from '../profit/profit.module';
import { NetProfitSettingsModule } from '../settings/net-profit-settings.module';
import { AdminSalesReportController } from './admin-sales-report.controller';
import { SalesReportService } from './sales-report.service';
import { ProductPnlService } from './product-pnl.service';
import { ShippingRulesModule } from '../../shipping-rules/shipping-rules.module';
import { ShippingZonesModule } from '../../shipping-zones/shipping-zones.module';
import { ProductCostHistoryModule } from '../../product-cost-history/product-cost-history.module';
import { ReportSettingsService } from './report-settings.service';
import { ReportLoaderService } from './report-loader.service';
import { SalesReportV2Service } from './sales-report-v2.service';
import { AdminSalesReportV2Controller } from './admin-sales-report-v2.controller';
import { CourierBillsService } from './courier-bills.service';

@Module({
  imports: [
    ProfitModule,
    ShippingRulesModule,
    ShippingZonesModule,
    NetProfitSettingsModule,
    ProductCostHistoryModule,
  ],
  controllers: [AdminSalesReportController, AdminSalesReportV2Controller],
  providers: [
    SalesReportService,
    ProductPnlService,
    ReportSettingsService,
    ReportLoaderService,
    SalesReportV2Service,
    CourierBillsService,
  ],
  exports: [SalesReportService, ProductPnlService],
})
export class SalesReportModule {}
