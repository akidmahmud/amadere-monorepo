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
import { BlogTagsService } from './blog-tags.service';
import { CreateBlogTagDto } from './dto/create-blog-tag.dto';
import { UpdateBlogTagDto } from './dto/update-blog-tag.dto';
import { AdminBlogTagDto } from './blog-tags.mapper';

@ApiTags('admin/blog-tags')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/blog-tags')
export class AdminBlogTagsController {
  constructor(private readonly tags: BlogTagsService) {}

  @Get()
  @RequirePermission('blog_tag.view')
  @ApiPaginatedResponse(AdminBlogTagDto)
  list(
    @Query() { page, pageSize }: PaginationQueryDto,
  ): Promise<PaginatedResult<AdminBlogTagDto>> {
    return this.tags.adminList(page ?? 1, pageSize ?? 20);
  }

  @Get(':id')
  @RequirePermission('blog_tag.view')
  @ApiOkResponse({ type: AdminBlogTagDto })
  get(@Param('id', ParseIntPipe) id: number): Promise<AdminBlogTagDto> {
    return this.tags.adminGet(id);
  }

  @Post()
  @RequirePermission('blog_tag.create')
  @ApiOkResponse({ type: AdminBlogTagDto })
  create(@Body() dto: CreateBlogTagDto): Promise<AdminBlogTagDto> {
    return this.tags.create(dto);
  }

  @Patch(':id')
  @RequirePermission('blog_tag.update')
  @ApiOkResponse({ type: AdminBlogTagDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBlogTagDto,
  ): Promise<AdminBlogTagDto> {
    return this.tags.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('blog_tag.delete')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.tags.delete(id);
  }
}
