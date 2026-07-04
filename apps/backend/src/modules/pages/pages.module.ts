import { Module } from '@nestjs/common';
import { SeoModule } from '../seo/seo.module';
import { PagesController } from './pages.controller';
import { AdminPagesController } from './admin-pages.controller';
import { PagesService } from './pages.service';

@Module({
  imports: [SeoModule],
  controllers: [PagesController, AdminPagesController],
  providers: [PagesService],
})
export class PagesModule {}
