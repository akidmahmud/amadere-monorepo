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
import { ApiBearerAuth, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaginatedResult } from '@amader/shared';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ApiPaginatedResponse } from '../../common/dto/paginated-response.dto';
import { BlogCategoriesService } from './blog-categories.service';
import { CreateBlogCategoryDto } from './dto/create-blog-category.dto';
import { UpdateBlogCategoryDto } from './dto/update-blog-category.dto';
import { AdminBlogCategoryDto } from './blog-categories.mapper';

@ApiTags('admin/blog-categories')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/blog-categories')
export class AdminBlogCategoriesController {
  constructor(private readonly categories: BlogCategoriesService) {}

  @Get()
  @RequirePermission('blog_category.view')
  @ApiQuery({ name: 'parentId', required: false, type: Number })
  @ApiPaginatedResponse(AdminBlogCategoryDto)
  list(
    @Query() { page, pageSize }: PaginationQueryDto,
    @Query('parentId') parentId?: string,
  ): Promise<PaginatedResult<AdminBlogCategoryDto>> {
    return this.categories.adminList(
      page ?? 1,
      pageSize ?? 20,
      parentId ? Number(parentId) : undefined,
    );
  }

  @Get(':id')
  @RequirePermission('blog_category.view')
  @ApiOkResponse({ type: AdminBlogCategoryDto })
  get(@Param('id', ParseIntPipe) id: number): Promise<AdminBlogCategoryDto> {
    return this.categories.adminGet(id);
  }

  @Post()
  @RequirePermission('blog_category.create')
  @ApiOkResponse({ type: AdminBlogCategoryDto })
  create(@Body() dto: CreateBlogCategoryDto): Promise<AdminBlogCategoryDto> {
    return this.categories.create(dto);
  }

  @Patch(':id')
  @RequirePermission('blog_category.update')
  @ApiOkResponse({ type: AdminBlogCategoryDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBlogCategoryDto,
  ): Promise<AdminBlogCategoryDto> {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('blog_category.delete')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.categories.delete(id);
  }
}
