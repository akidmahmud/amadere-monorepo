import { Module } from '@nestjs/common';
import { NetProfitSettingsModule } from '../settings/net-profit-settings.module';
import { AdminSmsController } from './admin-sms.controller';
import { SmsService } from './sms.service';
import { BulkSmsBdProvider } from './providers/bulk-sms-bd.provider';
import { SmsEventListener } from './sms-event.listener';

@Module({
  imports: [NetProfitSettingsModule],
  controllers: [AdminSmsController],
  providers: [SmsService, BulkSmsBdProvider, SmsEventListener],
  exports: [SmsService],
})
export class SmsModule {}
