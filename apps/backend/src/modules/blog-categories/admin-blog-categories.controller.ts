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
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { BlogCategoriesService } from './blog-categories.service';
import { CreateBlogCategoryDto } from './dto/create-blog-category.dto';
import { UpdateBlogCategoryDto } from './dto/update-blog-category.dto';

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
  list(
    @Query() { page, pageSize }: PaginationQueryDto,
    @Query('parentId') parentId?: string,
  ) {
    return this.categories.adminList(
      page ?? 1,
      pageSize ?? 20,
      parentId ? Number(parentId) : undefined,
    );
  }

  @Get(':id')
  @RequirePermission('blog_category.view')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.categories.adminGet(id);
  }

  @Post()
  @RequirePermission('blog_category.create')
  create(@Body() dto: CreateBlogCategoryDto) {
    return this.categories.create(dto);
  }

  @Patch(':id')
  @RequirePermission('blog_category.update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBlogCategoryDto,
  ) {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('blog_category.delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.categories.delete(id);
  }
}
