import { Module } from '@nestjs/common';
import { PagesController } from './pages.controller';
import { AdminPagesController } from './admin-pages.controller';
import { PagesService } from './pages.service';

@Module({
  controllers: [PagesController, AdminPagesController],
  providers: [PagesService],
})
export class PagesModule {}
