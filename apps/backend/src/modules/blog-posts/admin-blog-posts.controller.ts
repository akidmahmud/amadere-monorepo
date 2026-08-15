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
import { ContentStatus } from '@amader/db';
import { PaginatedResult } from '@amader/shared';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { CurrentAdmin } from '../../common/auth/current-admin.decorator';
import { SuperAdminGuard } from '../../common/auth/super-admin.guard';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { ApiPaginatedResponse } from '../../common/dto/paginated-response.dto';
import { BlogPostsService } from './blog-posts.service';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';
import { UpdateBlogPostDto } from './dto/update-blog-post.dto';
import { AdminBlogPostDto, AdminDeletedBlogPostDto, BlogPostRevisionDto } from './blog-posts.mapper';
import { LinkSuggestion } from './internal-links.util';

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
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'categoryId', required: false, type: Number })
  @ApiQuery({ name: 'tagId', required: false, type: Number })
  @ApiQuery({ name: 'isFeatured', required: false, type: Boolean })
  @ApiPaginatedResponse(AdminBlogPostDto)
  list(
    @Query() { page, pageSize }: PaginationQueryDto,
    @Query('status') status?: ContentStatus,
    @Query('authorId') authorId?: string,
    @Query('q') q?: string,
    @Query('categoryId') categoryId?: string,
    @Query('tagId') tagId?: string,
    @Query('isFeatured') isFeatured?: string,
  ): Promise<PaginatedResult<AdminBlogPostDto>> {
    return this.posts.adminList(
      page ?? 1,
      pageSize ?? 20,
      status,
      authorId ? Number(authorId) : undefined,
      q,
      categoryId ? Number(categoryId) : undefined,
      tagId ? Number(tagId) : undefined,
      isFeatured !== undefined ? isFeatured === 'true' : undefined,
    );
  }

  @Get('stats')
  @RequirePermission('blog_post.view')
  stats() {
    return this.posts.adminStats();
  }

  // Super-admin only regardless of granted permissions — see SuperAdminGuard.
  // Declared before `:id` so Nest's route matching doesn't try to parse
  // "trash" as a numeric id first.
  @Get('trash')
  @UseGuards(SuperAdminGuard)
  @ApiPaginatedResponse(AdminDeletedBlogPostDto)
  listDeleted(
    @Query() { page, pageSize }: PaginationQueryDto,
    @Query('q') q?: string,
  ): Promise<PaginatedResult<AdminDeletedBlogPostDto>> {
    return this.posts.listDeleted(page ?? 1, pageSize ?? 20, q);
  }

  @Get(':id')
  @RequirePermission('blog_post.view')
  @ApiOkResponse({ type: AdminBlogPostDto })
  get(@Param('id', ParseIntPipe) id: number): Promise<AdminBlogPostDto> {
    return this.posts.adminGet(id);
  }

  @Post()
  @RequirePermission('blog_post.create')
  @ApiOkResponse({ type: AdminBlogPostDto })
  create(
    @Body() dto: CreateBlogPostDto,
    @CurrentAdmin() admin: { id: number },
  ): Promise<AdminBlogPostDto> {
    return this.posts.create(dto, admin.id);
  }

  @Patch(':id')
  @RequirePermission('blog_post.update')
  @ApiOkResponse({ type: AdminBlogPostDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBlogPostDto,
    @CurrentAdmin() admin: { id: number },
  ): Promise<AdminBlogPostDto> {
    return this.posts.update(id, dto, admin.id);
  }

  @Post(':id/preview-token')
  @RequirePermission('blog_post.view')
  previewToken(@Param('id', ParseIntPipe) id: number): Promise<{ token: string }> {
    return this.posts.generatePreviewToken(id);
  }

  @Get(':id/revisions')
  @RequirePermission('blog_post.view')
  @ApiOkResponse({ type: BlogPostRevisionDto, isArray: true })
  revisions(@Param('id', ParseIntPipe) id: number): Promise<BlogPostRevisionDto[]> {
    return this.posts.listRevisions(id);
  }

  @Delete(':id')
  @RequirePermission('blog_post.delete')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.posts.delete(id);
  }

  // Super-admin only regardless of granted permissions — see SuperAdminGuard.
  @Post(':id/restore')
  @UseGuards(SuperAdminGuard)
  @ApiOkResponse({ type: AdminBlogPostDto })
  restore(@Param('id', ParseIntPipe) id: number): Promise<AdminBlogPostDto> {
    return this.posts.restore(id);
  }

  @Post(':id/submit')
  @RequirePermission('blog_post.update')
  @ApiOkResponse({ type: AdminBlogPostDto })
  submit(@Param('id', ParseIntPipe) id: number): Promise<AdminBlogPostDto> {
    return this.posts.submitForReview(id);
  }

  @Post(':id/publish')
  @RequirePermission('blog_post.publish')
  @ApiOkResponse({ type: AdminBlogPostDto })
  publish(@Param('id', ParseIntPipe) id: number): Promise<AdminBlogPostDto> {
    return this.posts.publish(id);
  }

  @Post(':id/archive')
  @RequirePermission('blog_post.publish')
  @ApiOkResponse({ type: AdminBlogPostDto })
  archive(@Param('id', ParseIntPipe) id: number): Promise<AdminBlogPostDto> {
    return this.posts.archive(id);
  }

  @Get(':id/internal-link-suggestions')
  @RequirePermission('blog_post.update')
  @ApiOkResponse({ type: LinkSuggestion, isArray: true })
  internalLinkSuggestions(
    @Param('id', ParseIntPipe) id: number,
    @Query() { locale }: LocaleQueryDto,
  ): Promise<LinkSuggestion[]> {
    return this.posts.internalLinkSuggestions(id, locale ?? 'EN');
  }
}
