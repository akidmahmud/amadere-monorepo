import { Module } from '@nestjs/common';
import { AdminNewsletterTemplatesController } from './admin-newsletter-templates.controller';
import { NewsletterTemplatesService } from './newsletter-templates.service';

@Module({
  controllers: [AdminNewsletterTemplatesController],
  providers: [NewsletterTemplatesService],
  exports: [NewsletterTemplatesService],
})
export class NewsletterTemplatesModule {}
