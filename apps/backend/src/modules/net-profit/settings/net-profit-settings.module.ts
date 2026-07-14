import { Module } from '@nestjs/common';
import { NetProfitSettingsService } from './net-profit-settings.service';

@Module({
  providers: [NetProfitSettingsService],
  exports: [NetProfitSettingsService],
})
export class NetProfitSettingsModule {}
