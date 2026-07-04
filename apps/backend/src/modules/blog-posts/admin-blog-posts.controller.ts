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
import { ContentStatus } from '@amader/db';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { CurrentAdmin } from '../../common/auth/current-admin.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { BlogPostsService } from './blog-posts.service';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';
import { UpdateBlogPostDto } from './dto/update-blog-post.dto';

@ApiTags('admin/blog-posts')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/blog-posts')
export class AdminBlogPostsController {
  constructor(private readonly posts: BlogPostsService) {}

  @Get()
  @RequirePermission('blog_post.view')
  @ApiQuery({ name: 'status', required: false, enum: ContentStatus })
  @ApiQuery({ name: 'authorId', required: false, type: Number })
  list(
    @Query() { page, pageSize }: PaginationQueryDto,
    @Query('status') status?: ContentStatus,
    @Query('authorId') authorId?: string,
  ) {
    return this.posts.adminList(
      page ?? 1,
      pageSize ?? 20,
      status,
      authorId ? Number(authorId) : undefined,
    );
  }

  @Get(':id')
  @RequirePermission('blog_post.view')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.posts.adminGet(id);
  }

  @Post()
  @RequirePermission('blog_post.create')
  create(
    @Body() dto: CreateBlogPostDto,
    @CurrentAdmin() admin: { id: number },
  ) {
    return this.posts.create(dto, admin.id);
  }

  @Patch(':id')
  @RequirePermission('blog_post.update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBlogPostDto,
  ) {
    return this.posts.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('blog_post.delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.posts.delete(id);
  }

  @Post(':id/submit')
  @RequirePermission('blog_post.update')
  submit(@Param('id', ParseIntPipe) id: number) {
    return this.posts.submitForReview(id);
  }

  @Post(':id/publish')
  @RequirePermission('blog_post.publish')
  publish(@Param('id', ParseIntPipe) id: number) {
    return this.posts.publish(id);
  }

  @Post(':id/archive')
  @RequirePermission('blog_post.publish')
  archive(@Param('id', ParseIntPipe) id: number) {
    return this.posts.archive(id);
  }

  @Get(':id/internal-link-suggestions')
  @RequirePermission('blog_post.update')
  internalLinkSuggestions(
    @Param('id', ParseIntPipe) id: number,
    @Query() { locale }: LocaleQueryDto,
  ) {
    return this.posts.internalLinkSuggestions(id, locale ?? 'EN');
  }
}
