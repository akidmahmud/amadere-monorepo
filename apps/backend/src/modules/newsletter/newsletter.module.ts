import { Module } from '@nestjs/common';
import { NewsletterController } from './newsletter.controller';
import { AdminNewsletterController } from './admin-newsletter.controller';
import { NewsletterService } from './newsletter.service';
import { NewsletterTagsModule } from '../newsletter-tags/newsletter-tags.module';

@Module({
  imports: [NewsletterTagsModule],
  controllers: [NewsletterController, AdminNewsletterController],
  providers: [NewsletterService],
})
export class NewsletterModule {}
