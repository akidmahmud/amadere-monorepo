import { Module } from '@nestjs/common';
import { AdminTagsController } from './admin-tags.controller';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';

@Module({
  controllers: [TagsController, AdminTagsController],
  providers: [TagsService],
})
export class TagsModule {}
