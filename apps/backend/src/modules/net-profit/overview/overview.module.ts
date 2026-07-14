import { Module } from '@nestjs/common';
import { NetProfitSettingsModule } from '../settings/net-profit-settings.module';
import { AdminOverviewController } from './admin-overview.controller';
import { OverviewService } from './overview.service';
import { InventoryService } from './inventory.service';
import { ReturnedOrdersService } from './returned-orders.service';

@Module({
  imports: [NetProfitSettingsModule],
  controllers: [AdminOverviewController],
  providers: [OverviewService, InventoryService, ReturnedOrdersService],
})
export class OverviewModule {}
