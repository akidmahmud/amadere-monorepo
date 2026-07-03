import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { TagsService } from './tags.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

@ApiTags('admin/tags')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/tags')
export class AdminTagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  @RequirePermission('tag.view')
  list(@Query() { page, pageSize }: PaginationQueryDto) {
    return this.tags.adminList(page ?? 1, pageSize ?? 20);
  }

  @Get(':id')
  @RequirePermission('tag.view')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.tags.adminGet(id);
  }

  @Post()
  @RequirePermission('tag.create')
  create(@Body() dto: CreateTagDto) {
    return this.tags.create(dto);
  }

  @Patch(':id')
  @RequirePermission('tag.update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTagDto) {
    return this.tags.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('tag.delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tags.delete(id);
  }
}
