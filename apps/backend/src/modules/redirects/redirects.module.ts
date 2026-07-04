import { Module } from '@nestjs/common';
import { AdminRedirectsController } from './admin-redirects.controller';
import { RedirectsController } from './redirects.controller';
import { RedirectsService } from './redirects.service';

@Module({
  controllers: [AdminRedirectsController, RedirectsController],
  providers: [RedirectsService],
})
export class RedirectsModule {}
