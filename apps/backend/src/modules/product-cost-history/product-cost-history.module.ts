import { Module } from '@nestjs/common';
import { ProductCostHistoryService } from './product-cost-history.service';

@Module({
  providers: [ProductCostHistoryService],
  exports: [ProductCostHistoryService],
})
export class ProductCostHistoryModule {}
