import { Module } from '@nestjs/common';
import { AdminNewsletterSegmentsController } from './admin-newsletter-segments.controller';
import { NewsletterSegmentsService } from './newsletter-segments.service';

@Module({
  controllers: [AdminNewsletterSegmentsController],
  providers: [NewsletterSegmentsService],
  exports: [NewsletterSegmentsService],
})
export class NewsletterSegmentsModule {}
