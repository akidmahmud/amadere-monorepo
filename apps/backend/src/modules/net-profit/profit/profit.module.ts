import { Module } from '@nestjs/common';
import { NetProfitSettingsModule } from '../settings/net-profit-settings.module';
import { AdminProfitController } from './admin-profit.controller';
import { ProfitService } from './profit.service';

@Module({
  imports: [NetProfitSettingsModule],
  controllers: [AdminProfitController],
  providers: [ProfitService],
  exports: [ProfitService],
})
export class ProfitModule {}
