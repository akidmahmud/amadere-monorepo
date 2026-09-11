import { Module } from '@nestjs/common';
import { AdminTrafficController } from './admin-traffic.controller';
import { TrafficPublicController } from './traffic.public.controller';
import { TrafficService } from './traffic.service';

@Module({
  controllers: [TrafficPublicController, AdminTrafficController],
  providers: [TrafficService],
})
export class TrafficModule {}
