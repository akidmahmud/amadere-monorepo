import { Module } from '@nestjs/common';
import { ProfitModule } from '../profit/profit.module';
import { AdminSalesReportController } from './admin-sales-report.controller';
import { SalesReportService } from './sales-report.service';

@Module({
  imports: [ProfitModule],
  controllers: [AdminSalesReportController],
  providers: [SalesReportService],
  exports: [SalesReportService],
})
export class SalesReportModule {}
