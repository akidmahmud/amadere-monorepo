import { Module } from '@nestjs/common';
import { AdminNewsletterTagsController } from './admin-newsletter-tags.controller';
import { NewsletterTagsService } from './newsletter-tags.service';

@Module({
  controllers: [AdminNewsletterTagsController],
  providers: [NewsletterTagsService],
  exports: [NewsletterTagsService],
})
export class NewsletterTagsModule {}
