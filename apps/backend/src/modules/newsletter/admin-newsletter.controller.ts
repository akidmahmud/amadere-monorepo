import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PaginatedResult } from '@amader/shared';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { ApiPaginatedResponse } from '../../common/dto/paginated-response.dto';
import { NewsletterService } from './newsletter.service';
import { NewsletterSubscriberDto } from './newsletter.mapper';
import { AdminNewsletterQueryDto } from './dto/admin-newsletter-query.dto';
import { BulkDeleteNewsletterDto } from './dto/bulk-delete-newsletter.dto';

@ApiTags('admin/newsletter')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@Controller('admin/newsletter/subscribers')
export class AdminNewsletterController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Get()
  @RequirePermission('newsletter.view')
  @ApiPaginatedResponse(NewsletterSubscriberDto)
  list(@Query() query: AdminNewsletterQueryDto): Promise<PaginatedResult<NewsletterSubscriberDto>> {
    return this.newsletter.adminList(query);
  }

  @Get('export')
  @RequirePermission('newsletter.view')
  async export(@Query('q') q: string | undefined, @Res() res: Response) {
    const csv = await this.newsletter.exportCsv(q);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  }

  @Post('bulk-delete')
  @RequirePermission('newsletter.delete')
  bulkDelete(@Body() dto: BulkDeleteNewsletterDto): Promise<{ deleted: number }> {
    return this.newsletter.bulkDelete(dto.ids);
  }

  @Delete(':id')
  @RequirePermission('newsletter.delete')
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.newsletter.delete(id);
  }
}
