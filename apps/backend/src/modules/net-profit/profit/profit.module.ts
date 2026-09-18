import { Module } from '@nestjs/common';
import { NetProfitSettingsModule } from '../settings/net-profit-settings.module';
import { ProductCostHistoryModule } from '../../product-cost-history/product-cost-history.module';
import { AdminProfitController } from './admin-profit.controller';
import { ProfitService } from './profit.service';

@Module({
  imports: [NetProfitSettingsModule, ProductCostHistoryModule],
  controllers: [AdminProfitController],
  providers: [ProfitService],
  exports: [ProfitService],
})
export class ProfitModule {}
