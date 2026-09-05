import { Global, Module } from '@nestjs/common';
import { PushService } from './push.service';
import { StockAlertsService } from './stock-alerts.service';
import { PushPublicController } from './push.public.controller';
import { AdminPushController } from './admin-push.controller';

// Global so any module that wants to notify a customer can inject PushService
// without a web of imports — the same treatment the SMS and email senders get.
// It depends only on the two @Global modules (Prisma, Credentials), so it adds
// no cycles.
@Global()
@Module({
  controllers: [PushPublicController, AdminPushController],
  providers: [PushService, StockAlertsService],
  exports: [PushService, StockAlertsService],
})
export class PushModule {}
