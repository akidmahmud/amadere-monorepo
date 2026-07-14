import { Module } from '@nestjs/common';
import { AdminOrderStatusesController } from './admin-order-statuses.controller';
import { OrderStatusesService } from './order-statuses.service';

@Module({
  controllers: [AdminOrderStatusesController],
  providers: [OrderStatusesService],
})
export class OrderStatusesModule {}
