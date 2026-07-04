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
import { BlogTagsService } from './blog-tags.service';
import { CreateBlogTagDto } from './dto/create-blog-tag.dto';
import { UpdateBlogTagDto } from './dto/update-blog-tag.dto';

@ApiTags('admin/blog-tags')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/blog-tags')
export class AdminBlogTagsController {
  constructor(private readonly tags: BlogTagsService) {}

  @Get()
  @RequirePermission('blog_tag.view')
  list(@Query() { page, pageSize }: PaginationQueryDto) {
    return this.tags.adminList(page ?? 1, pageSize ?? 20);
  }

  @Get(':id')
  @RequirePermission('blog_tag.view')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.tags.adminGet(id);
  }

  @Post()
  @RequirePermission('blog_tag.create')
  create(@Body() dto: CreateBlogTagDto) {
    return this.tags.create(dto);
  }

  @Patch(':id')
  @RequirePermission('blog_tag.update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBlogTagDto) {
    return this.tags.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('blog_tag.delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tags.delete(id);
  }
}
