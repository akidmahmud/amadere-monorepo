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
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PaginatedResult } from '@amader/shared';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ApiPaginatedResponse } from '../../common/dto/paginated-response.dto';
import { TagsService } from './tags.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { AdminTagDto } from './tags.mapper';

@ApiTags('admin/tags')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/tags')
export class AdminTagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  @RequirePermission('tag.view')
  @ApiPaginatedResponse(AdminTagDto)
  list(
    @Query() { page, pageSize }: PaginationQueryDto,
  ): Promise<PaginatedResult<AdminTagDto>> {
    return this.tags.adminList(page ?? 1, pageSize ?? 20);
  }

  @Get(':id')
  @RequirePermission('tag.view')
  @ApiOkResponse({ type: AdminTagDto })
  get(@Param('id', ParseIntPipe) id: number): Promise<AdminTagDto> {
    return this.tags.adminGet(id);
  }

  @Post()
  @RequirePermission('tag.create')
  @ApiOkResponse({ type: AdminTagDto })
  create(@Body() dto: CreateTagDto): Promise<AdminTagDto> {
    return this.tags.create(dto);
  }

  @Patch(':id')
  @RequirePermission('tag.update')
  @ApiOkResponse({ type: AdminTagDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTagDto,
  ): Promise<AdminTagDto> {
    return this.tags.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('tag.delete')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.tags.delete(id);
  }
}
