import { Module } from '@nestjs/common';
import { AdminRbacController } from './admin-rbac.controller';
import { RbacService } from './rbac.service';

@Module({
  controllers: [AdminRbacController],
  providers: [RbacService],
})
export class RbacModule {}
