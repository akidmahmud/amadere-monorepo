import { Module } from '@nestjs/common';
import { NetProfitSettingsModule } from '../settings/net-profit-settings.module';
import { AdminOtpSecurityController } from './admin-otp-security.controller';
import { OtpSecurityService } from './otp-security.service';
import { IpApiVpnDetector } from './providers/ip-api-vpn-detector';

@Module({
  imports: [NetProfitSettingsModule],
  controllers: [AdminOtpSecurityController],
  providers: [OtpSecurityService, IpApiVpnDetector],
  exports: [OtpSecurityService],
})
export class OtpSecurityModule {}
