import { Module } from '@nestjs/common';
import { NetProfitSettingsModule } from '../settings/net-profit-settings.module';
import { AdminBlockerController } from './admin-blocker.controller';
import { BlockerService } from './blocker.service';

@Module({
  imports: [NetProfitSettingsModule],
  controllers: [AdminBlockerController],
  providers: [BlockerService],
  exports: [BlockerService],
})
export class BlockerModule {}
