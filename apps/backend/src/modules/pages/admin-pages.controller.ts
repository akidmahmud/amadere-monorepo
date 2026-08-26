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
import { PagesService } from './pages.service';
import { CurrentAdmin } from '../../common/auth/current-admin.decorator';
import { CreatePageDto } from './dto/create-page.dto';
import {
  PageRevisionDto,
  PublishLayoutDto,
  SaveLayoutDto,
} from './dto/page-layout.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { AdminPageDto } from './pages.mapper';

@ApiTags('admin/pages')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/pages')
export class AdminPagesController {
  constructor(private readonly pages: PagesService) {}

  @Get()
  @RequirePermission('page.view')
  @ApiQuery({ name: 'q', required: false })
  @ApiPaginatedResponse(AdminPageDto)
  list(
    @Query() { page, pageSize }: PaginationQueryDto,
    @Query('q') q?: string,
  ): Promise<PaginatedResult<AdminPageDto>> {
    return this.pages.adminList(page ?? 1, pageSize ?? 20, q);
  }

  @Get(':id')
  @RequirePermission('page.view')
  @ApiOkResponse({ type: AdminPageDto })
  get(@Param('id', ParseIntPipe) id: number): Promise<AdminPageDto> {
    return this.pages.adminGet(id);
  }

  @Post()
  @RequirePermission('page.create')
  @ApiOkResponse({ type: AdminPageDto })
  create(@Body() dto: CreatePageDto): Promise<AdminPageDto> {
    return this.pages.create(dto);
  }

  @Patch(':id')
  @RequirePermission('page.update')
  @ApiOkResponse({ type: AdminPageDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePageDto,
  ): Promise<AdminPageDto> {
    return this.pages.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('page.delete')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.pages.delete(id);
  }

  // -------------------------------------------------------------
  // Page builder
  // -------------------------------------------------------------

  // Autosaved draft. page.update only: a draft cannot reach a customer, so it
  // does not warrant the stricter checkout permission.
  @Patch(':id/layout')
  @RequirePermission('page.update')
  saveLayout(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaveLayoutDto,
  ): Promise<{ success: true }> {
    return this.pages.saveDraftLayout(id, dto.locale, dto.layout);
  }

  /**
   * Publish a CONTENT page.
   *
   * Publishing is split into two endpoints rather than one that inspects the
   * row's `kind`, because the permission required depends on that kind and
   * @RequirePermission is evaluated before any data is loaded. Two static
   * declarations the guard can enforce beat one dynamic check duplicating the
   * guard's own permission lookup inside the service.
   */
  @Post(':id/publish')
  @RequirePermission('page.update')
  publish(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PublishLayoutDto,
    @CurrentAdmin() admin: { id: number },
  ): Promise<{ success: true }> {
    return this.pages.publishLayout(id, dto.locale, 'CONTENT', dto.label, admin.id);
  }

  /** Publish a CHECKOUT page — replaces the live order form when this page is
   *  the active checkout, hence the dedicated permission. */
  @Post(':id/publish-checkout')
  @RequirePermission('page.checkout_publish')
  publishCheckout(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PublishLayoutDto,
    @CurrentAdmin() admin: { id: number },
  ): Promise<{ success: true }> {
    return this.pages.publishLayout(id, dto.locale, 'CHECKOUT', dto.label, admin.id);
  }

  @Post(':id/preview-token')
  @RequirePermission('page.view')
  previewToken(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ token: string }> {
    return this.pages.generatePreviewToken(id);
  }

  @Get(':id/revisions')
  @RequirePermission('page.view')
  @ApiOkResponse({ type: PageRevisionDto, isArray: true })
  revisions(@Param('id', ParseIntPipe) id: number) {
    return this.pages.listRevisions(id);
  }

  @Post(':id/revisions/:revisionId/restore')
  @RequirePermission('page.update')
  restore(
    @Param('id', ParseIntPipe) id: number,
    @Param('revisionId', ParseIntPipe) revisionId: number,
  ): Promise<{ success: true }> {
    return this.pages.restoreRevision(id, revisionId);
  }

  // Swapping the live checkout is the highest-risk action in this module.
  @Post(':id/set-default-checkout')
  @RequirePermission('page.checkout_publish')
  setDefaultCheckout(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ success: true }> {
    return this.pages.setDefaultCheckout(id);
  }

  // The "Restore default layout" button: falls /checkout back to code.
  @Post('checkout/restore-default')
  @RequirePermission('page.checkout_publish')
  restoreDefaultCheckout(): Promise<{ success: true }> {
    return this.pages.clearDefaultCheckout();
  }
}
