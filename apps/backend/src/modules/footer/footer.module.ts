import { Module } from '@nestjs/common';
import { AdminFooterController } from './admin-footer.controller';
import { FooterController } from './footer.controller';
import { FooterService } from './footer.service';

@Module({
  controllers: [FooterController, AdminFooterController],
  providers: [FooterService],
})
export class FooterModule {}
