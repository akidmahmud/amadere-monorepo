import { Module } from '@nestjs/common';
import { AdminMediaController } from './admin-media.controller';
import { MediaService } from './media.service';
import { MEDIA_STORAGE } from './storage/media-storage.interface';
import { R2MediaStorage } from './storage/r2-media-storage';

@Module({
  controllers: [AdminMediaController],
  providers: [
    MediaService,
    { provide: MEDIA_STORAGE, useClass: R2MediaStorage },
  ],
  exports: [MediaService],
})
export class MediaModule {}
