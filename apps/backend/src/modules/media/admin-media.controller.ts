import {
  Body,
  Controller,
  Delete,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { MediaService } from './media.service';
import { UploadMediaDto } from './dto/upload-media.dto';

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB

@ApiTags('admin/media')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/media')
export class AdminMediaController {
  constructor(private readonly media: MediaService) {}

  @Get()
  @RequirePermission('media.view')
  list(@Query() { page, pageSize }: PaginationQueryDto) {
    return this.media.list(page ?? 1, pageSize ?? 20);
  }

  @Post()
  @RequirePermission('media.upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  upload(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_UPLOAD_BYTES })],
      }),
    )
    file: Express.Multer.File,
    @Body() dto: UploadMediaDto,
  ) {
    return this.media.upload(file, dto.altText);
  }

  @Delete(':id')
  @RequirePermission('media.delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.media.delete(id);
  }
}
