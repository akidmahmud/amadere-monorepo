import { Module } from '@nestjs/common';
import { NetProfitSettingsModule } from '../settings/net-profit-settings.module';
import { ProductCostHistoryModule } from '../../product-cost-history/product-cost-history.module';
import { ShippingRulesModule } from '../../shipping-rules/shipping-rules.module';
import { AdminDailyReportController } from './admin-daily-report.controller';
import { DailyReportLoader } from './daily-report.loader';
import { DailyReportService } from './daily-report.service';

@Module({
  imports: [
    NetProfitSettingsModule,
    ProductCostHistoryModule,
    ShippingRulesModule,
  ],
  controllers: [AdminDailyReportController],
  providers: [DailyReportService, DailyReportLoader],
})
export class DailyReportModule {}
