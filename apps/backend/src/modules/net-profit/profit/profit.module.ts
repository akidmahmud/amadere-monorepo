import { Module } from '@nestjs/common';
import { AdminProfitController } from './admin-profit.controller';
import { ProfitService } from './profit.service';

@Module({
  controllers: [AdminProfitController],
  providers: [ProfitService],
  exports: [ProfitService],
})
export class ProfitModule {}
