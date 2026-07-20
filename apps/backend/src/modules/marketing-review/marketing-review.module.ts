import { Module } from '@nestjs/common';
import { AdminMarketingReviewController } from './admin-marketing-review.controller';
import { MarketingReviewController } from './marketing-review.controller';
import { MarketingReviewService } from './marketing-review.service';

@Module({
  controllers: [MarketingReviewController, AdminMarketingReviewController],
  providers: [MarketingReviewService],
})
export class MarketingReviewModule {}
