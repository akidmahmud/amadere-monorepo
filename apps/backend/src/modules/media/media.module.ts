import { Module } from '@nestjs/common';
import { AdminMediaController } from './admin-media.controller';
import { AdminMediaFoldersController } from './admin-media-folders.controller';
import { MediaService } from './media.service';
import { MEDIA_STORAGE } from './storage/media-storage.interface';
import { R2MediaStorage } from './storage/r2-media-storage';
import { MirroredMediaStorage } from './storage/mirrored-media-storage';

@Module({
  controllers: [AdminMediaController, AdminMediaFoldersController],
  providers: [
    MediaService,
    R2MediaStorage,
    // R2 plus a full copy on the VPS disk (fallback when R2 is down).
    { provide: MEDIA_STORAGE, useClass: MirroredMediaStorage },
  ],
  // MEDIA_STORAGE must be exported too — digital-products injects it
  // directly to reach uploadPrivate()/getObjectStream(), which MediaService
  // doesn't expose.
  exports: [MediaService, MEDIA_STORAGE],
})
export class MediaModule {}
