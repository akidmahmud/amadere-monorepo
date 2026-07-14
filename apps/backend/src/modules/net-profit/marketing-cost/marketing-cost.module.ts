import { Module } from '@nestjs/common';
import { AdminMarketingCostController } from './admin-marketing-cost.controller';
import { AdminDailyProfitController } from './admin-daily-profit.controller';
import { MarketingCostService } from './marketing-cost.service';
import { DailyProfitCacheService } from './daily-profit-cache.service';

@Module({
  controllers: [AdminMarketingCostController, AdminDailyProfitController],
  providers: [MarketingCostService, DailyProfitCacheService],
  exports: [MarketingCostService, DailyProfitCacheService],
})
export class MarketingCostModule {}
