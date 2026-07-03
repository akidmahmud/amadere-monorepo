import { Module } from '@nestjs/common';
import { AdminBrandsController } from './admin-brands.controller';
import { BrandsController } from './brands.controller';
import { BrandsService } from './brands.service';

@Module({
  controllers: [BrandsController, AdminBrandsController],
  providers: [BrandsService],
})
export class BrandsModule {}
