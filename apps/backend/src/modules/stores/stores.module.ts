import { Module } from '@nestjs/common';
import { AdminStoresController } from './admin-stores.controller';
import { StoresService } from './stores.service';

@Module({
  controllers: [AdminStoresController],
  providers: [StoresService],
  exports: [StoresService],
})
export class StoresModule {}
