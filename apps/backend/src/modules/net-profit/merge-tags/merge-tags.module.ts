import { Module } from '@nestjs/common';
import { MergeTagsService } from './merge-tags.service';

@Module({
  providers: [MergeTagsService],
  exports: [MergeTagsService],
})
export class MergeTagsModule {}
