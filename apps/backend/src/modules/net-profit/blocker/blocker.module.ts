import { Module } from '@nestjs/common';
import { NetProfitSettingsModule } from '../settings/net-profit-settings.module';
import { FraudModule } from '../fraud/fraud.module';
import { OtpSecurityModule } from '../otp-security/otp-security.module';
import { AdminBlockerController } from './admin-blocker.controller';
import { BlockerService } from './blocker.service';
import { BlockerRulesService } from './blocker-rules.service';

@Module({
  imports: [NetProfitSettingsModule, FraudModule, OtpSecurityModule],
  controllers: [AdminBlockerController],
  providers: [BlockerService, BlockerRulesService],
  exports: [BlockerService],
})
export class BlockerModule {}
