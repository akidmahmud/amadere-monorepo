import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { AdminAnnouncementDto } from './announcements.mapper';

@ApiTags('admin/announcements')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/announcements')
export class AdminAnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  @RequirePermission('announcement.view')
  @ApiOkResponse({ type: AdminAnnouncementDto, isArray: true })
  list(): Promise<AdminAnnouncementDto[]> {
    return this.announcements.adminList();
  }

  @Get(':id')
  @RequirePermission('announcement.view')
  @ApiOkResponse({ type: AdminAnnouncementDto })
  get(@Param('id', ParseIntPipe) id: number): Promise<AdminAnnouncementDto> {
    return this.announcements.adminGet(id);
  }

  @Post()
  @RequirePermission('announcement.create')
  @ApiOkResponse({ type: AdminAnnouncementDto })
  create(@Body() dto: CreateAnnouncementDto): Promise<AdminAnnouncementDto> {
    return this.announcements.create(dto);
  }

  @Patch(':id')
  @RequirePermission('announcement.update')
  @ApiOkResponse({ type: AdminAnnouncementDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAnnouncementDto,
  ): Promise<AdminAnnouncementDto> {
    return this.announcements.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('announcement.delete')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.announcements.delete(id);
  }
}
