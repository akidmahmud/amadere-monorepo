import { Module } from '@nestjs/common';
import { StoresModule } from '../stores/stores.module';
import { StockService } from './stock.service';
import { StockDocsService } from './stock-docs.service';
import { TransfersService } from './transfers.service';
import { AdminStockController } from './admin-stock.controller';

@Module({
  imports: [StoresModule],
  controllers: [AdminStockController],
  providers: [StockService, StockDocsService, TransfersService],
  exports: [StockService],
})
export class StockModule {}
