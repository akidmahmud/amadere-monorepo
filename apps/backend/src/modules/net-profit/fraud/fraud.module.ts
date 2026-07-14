import { Module } from '@nestjs/common';
import { SteadfastCourierProvider } from '../../courier/providers/steadfast-courier.provider';
import { NetProfitSettingsModule } from '../settings/net-profit-settings.module';
import { AdminFraudController } from './admin-fraud.controller';
import { FraudPublicController } from './fraud.public.controller';
import { FraudService } from './fraud.service';
import { SteadfastFraudSource } from './providers/steadfast-fraud-source';

// Provides its own SteadfastCourierProvider instance (stateless — just
// wraps ConfigService per call) rather than importing CourierModule, which
// pulls in OrdersModule and would create OrdersModule -> FraudModule ->
// CourierModule -> OrdersModule cycle once the checkout gate (below) needs
// FraudService from OrdersModule.
@Module({
  imports: [NetProfitSettingsModule],
  controllers: [AdminFraudController, FraudPublicController],
  providers: [FraudService, SteadfastCourierProvider, SteadfastFraudSource],
  exports: [FraudService],
})
export class FraudModule {}
