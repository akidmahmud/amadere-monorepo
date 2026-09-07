import { Module } from '@nestjs/common';
import { AdminGatewayPaymentsController } from './admin-gateway-payments.controller';
import { GatewayPaymentsService } from './gateway-payments.service';

@Module({
  controllers: [AdminGatewayPaymentsController],
  providers: [GatewayPaymentsService],
})
export class GatewayPaymentsModule {}
