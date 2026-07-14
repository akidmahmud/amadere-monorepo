import { Module } from '@nestjs/common';
import { NetProfitSettingsModule } from '../settings/net-profit-settings.module';
import { BlockerModule } from '../blocker/blocker.module';
import { AdminCleanupController } from './admin-cleanup.controller';
import { CleanupService } from './cleanup.service';

@Module({
  imports: [NetProfitSettingsModule, BlockerModule],
  controllers: [AdminCleanupController],
  providers: [CleanupService],
  exports: [CleanupService],
})
export class CleanupModule {}
