import { Module } from '@nestjs/common';
import { AdminSalesReportController } from './admin-sales-report.controller';
import { SalesReportService } from './sales-report.service';

@Module({
  controllers: [AdminSalesReportController],
  providers: [SalesReportService],
})
export class SalesReportModule {}
