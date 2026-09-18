import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { MediaService } from './media.service';
import { CreateMediaFolderDto } from './dto/create-media-folder.dto';
import { RenameMediaFolderDto } from './dto/rename-media-folder.dto';
import { MediaFolderDto } from './media.mapper';

@ApiTags('admin/media-folders')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/media-folders')
export class AdminMediaFoldersController {
  constructor(private readonly media: MediaService) {}

  @Get()
  @RequirePermission('media.view')
  @ApiOkResponse({ type: MediaFolderDto, isArray: true })
  list(): Promise<MediaFolderDto[]> {
    return this.media.listFolders();
  }

  @Post()
  @RequirePermission('media.upload')
  @ApiOkResponse({ type: MediaFolderDto })
  create(@Body() dto: CreateMediaFolderDto): Promise<MediaFolderDto> {
    return this.media.createFolder(dto.name, dto.parentId);
  }

  @Patch(':id')
  @RequirePermission('media.upload')
  @ApiOkResponse({ type: MediaFolderDto })
  rename(@Param('id', ParseIntPipe) id: number, @Body() dto: RenameMediaFolderDto): Promise<MediaFolderDto> {
    return this.media.renameFolder(id, dto.name);
  }

  /** "<name> (copy)" with every subfolder and file, files copied in storage. */
  @Post(':id/duplicate')
  @RequirePermission('media.upload')
  @ApiOkResponse({ type: MediaFolderDto })
  duplicate(@Param('id', ParseIntPipe) id: number): Promise<MediaFolderDto> {
    return this.media.duplicateFolder(id);
  }

  @Delete(':id')
  @RequirePermission('media.delete')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.media.deleteFolder(id);
  }
}
