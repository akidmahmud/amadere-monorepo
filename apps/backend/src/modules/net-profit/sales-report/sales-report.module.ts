import { Module } from '@nestjs/common';
import { ProfitModule } from '../profit/profit.module';
import { AdminSalesReportController } from './admin-sales-report.controller';
import { SalesReportService } from './sales-report.service';
import { ProductPnlService } from './product-pnl.service';
import { ShippingRulesModule } from '../../shipping-rules/shipping-rules.module';

@Module({
  imports: [ProfitModule, ShippingRulesModule],
  controllers: [AdminSalesReportController],
  providers: [SalesReportService, ProductPnlService],
  exports: [SalesReportService, ProductPnlService],
})
export class SalesReportModule {}
