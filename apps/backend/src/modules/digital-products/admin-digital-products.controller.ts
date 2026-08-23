import {
  Body,
  Controller,
  Delete,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiConsumes, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DIGITAL_FILE_MAX_BYTES } from '@amader/shared';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { DigitalProductsService } from './digital-products.service';
import { SetPreviewRangeDto } from './dto/set-preview-range.dto';
import { AdminDigitalFileDto } from './dto/digital-file-response.dto';

@ApiTags('admin/digital-products')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/digital-products')
export class AdminDigitalProductsController {
  constructor(private readonly digital: DigitalProductsService) {}

  // 50MB, not the media module's 20MB — a book routinely exceeds 20MB, and a
  // truncated upload is worse than a clear rejection.
  @Post(':id/file')
  @RequirePermission('digital_product.update')
  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({ type: AdminDigitalFileDto })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadFile(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: DIGITAL_FILE_MAX_BYTES })],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.digital.attachFile(id, file);
  }

  @Delete(':id/file')
  @RequirePermission('digital_product.update')
  @ApiOkResponse({ type: AdminDigitalFileDto })
  removeFile(@Param('id', ParseIntPipe) id: number) {
    return this.digital.removeFile(id);
  }

  // Re-renders the previews from the already-stored PDF, so changing which
  // pages are shown never needs a re-upload.
  @Patch(':id/preview-range')
  @RequirePermission('digital_product.update')
  @ApiOkResponse({ type: AdminDigitalFileDto })
  setPreviewRange(@Param('id', ParseIntPipe) id: number, @Body() dto: SetPreviewRangeDto) {
    return this.digital.setPreviewRange(id, dto.startPage, dto.endPage);
  }
}
