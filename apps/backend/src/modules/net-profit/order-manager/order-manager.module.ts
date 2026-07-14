import { Module } from '@nestjs/common';
import { OrdersModule } from '../../orders/orders.module';
import { CourierModule } from '../../courier/courier.module';
import { BlockerModule } from '../blocker/blocker.module';
import { AdminOrderManagerController } from './admin-order-manager.controller';
import { OrderManagerService } from './order-manager.service';

@Module({
  imports: [OrdersModule, CourierModule, BlockerModule],
  controllers: [AdminOrderManagerController],
  providers: [OrderManagerService],
})
export class OrderManagerModule {}
