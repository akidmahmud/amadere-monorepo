import { Module } from '@nestjs/common';
import { NetProfitSettingsModule } from '../settings/net-profit-settings.module';
import { SalesReportModule } from '../sales-report/sales-report.module';
import { SmtpEmailProvider } from '../cart-campaigns/providers/smtp-email.provider';
import { EmailSettingsModule } from '../../email-settings/email-settings.module';
import { AdminMarketingCostController } from './admin-marketing-cost.controller';
import { AdminDailyProfitController } from './admin-daily-profit.controller';
import { MarketingCostService } from './marketing-cost.service';
import { DailyProfitCacheService } from './daily-profit-cache.service';

@Module({
  imports: [NetProfitSettingsModule, SalesReportModule, EmailSettingsModule],
  controllers: [AdminMarketingCostController, AdminDailyProfitController],
  providers: [MarketingCostService, DailyProfitCacheService, SmtpEmailProvider],
  exports: [MarketingCostService, DailyProfitCacheService],
})
export class MarketingCostModule {}
