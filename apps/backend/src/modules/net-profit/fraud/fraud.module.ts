import { Module } from '@nestjs/common';
import { SteadfastCourierProvider } from '../../courier/providers/steadfast-courier.provider';
import { CourierSettingsService } from '../../courier/courier-settings.service';
import { NetProfitSettingsModule } from '../settings/net-profit-settings.module';
import { AdminFraudController } from './admin-fraud.controller';
import { FraudPublicController } from './fraud.public.controller';
import { FraudService } from './fraud.service';
import { SteadfastFraudSource } from './providers/steadfast-fraud-source';

// Provides its own SteadfastCourierProvider instance (stateless — just
// wraps ConfigService/CourierSettingsService per call) rather than
// importing CourierModule, which pulls in OrdersModule and would create
// OrdersModule -> FraudModule -> CourierModule -> OrdersModule cycle once
// the checkout gate (below) needs FraudService from OrdersModule.
// CourierSettingsService only depends on the two @Global modules
// (Prisma/Credentials), so a second stateless instance here is safe.
@Module({
  imports: [NetProfitSettingsModule],
  controllers: [AdminFraudController, FraudPublicController],
  providers: [FraudService, SteadfastCourierProvider, CourierSettingsService, SteadfastFraudSource],
  exports: [FraudService],
})
export class FraudModule {}
