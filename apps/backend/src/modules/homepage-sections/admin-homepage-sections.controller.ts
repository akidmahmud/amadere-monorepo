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
import { HomepageSectionsService } from './homepage-sections.service';
import { CreateHomepageSectionDto } from './dto/create-homepage-section.dto';
import { UpdateHomepageSectionDto } from './dto/update-homepage-section.dto';
import { ReorderHomepageSectionsDto } from './dto/reorder-homepage-sections.dto';
import { AdminHomepageSectionDto } from './homepage-sections.mapper';

@ApiTags('admin/homepage-sections')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/homepage-sections')
export class AdminHomepageSectionsController {
  constructor(private readonly sections: HomepageSectionsService) {}

  @Get()
  @RequirePermission('homepage_section.view')
  @ApiOkResponse({ type: AdminHomepageSectionDto, isArray: true })
  list(): Promise<AdminHomepageSectionDto[]> {
    return this.sections.adminList();
  }

  @Get(':id')
  @RequirePermission('homepage_section.view')
  @ApiOkResponse({ type: AdminHomepageSectionDto })
  get(@Param('id', ParseIntPipe) id: number): Promise<AdminHomepageSectionDto> {
    return this.sections.adminGet(id);
  }

  @Post()
  @RequirePermission('homepage_section.create')
  @ApiOkResponse({ type: AdminHomepageSectionDto })
  create(
    @Body() dto: CreateHomepageSectionDto,
  ): Promise<AdminHomepageSectionDto> {
    return this.sections.create(dto);
  }

  @Patch('reorder')
  @RequirePermission('homepage_section.update')
  reorder(@Body() dto: ReorderHomepageSectionsDto): Promise<void> {
    return this.sections.reorder(dto.ids);
  }

  @Patch(':id')
  @RequirePermission('homepage_section.update')
  @ApiOkResponse({ type: AdminHomepageSectionDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHomepageSectionDto,
  ): Promise<AdminHomepageSectionDto> {
    return this.sections.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('homepage_section.delete')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.sections.delete(id);
  }
}
