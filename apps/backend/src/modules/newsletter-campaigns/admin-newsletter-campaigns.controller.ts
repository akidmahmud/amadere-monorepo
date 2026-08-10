import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PaginatedResult } from '@amader/shared';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ApiPaginatedResponse } from '../../common/dto/paginated-response.dto';
import { CreateCampaignDto, PreviewContentDto, ScheduleCampaignDto, SendTestCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { CampaignAnalytics, NewsletterCampaignsService } from './newsletter-campaigns.service';
import { AdminNewsletterCampaignDto } from './newsletter-campaigns.mapper';

@ApiTags('admin/newsletter/campaigns')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/newsletter/campaigns')
export class AdminNewsletterCampaignsController {
  constructor(private readonly campaigns: NewsletterCampaignsService) {}

  @Get()
  @RequirePermission('newsletter_campaign.view')
  @ApiPaginatedResponse(AdminNewsletterCampaignDto)
  list(@Query() { page, pageSize }: PaginationQueryDto): Promise<PaginatedResult<AdminNewsletterCampaignDto>> {
    return this.campaigns.adminList(page ?? 1, pageSize ?? 20);
  }

  @Get(':id')
  @RequirePermission('newsletter_campaign.view')
  @ApiOkResponse({ type: AdminNewsletterCampaignDto })
  get(@Param('id', ParseIntPipe) id: number): Promise<AdminNewsletterCampaignDto> {
    return this.campaigns.adminGet(id);
  }

  @Get(':id/analytics')
  @RequirePermission('newsletter_campaign.view')
  analytics(@Param('id', ParseIntPipe) id: number): Promise<CampaignAnalytics> {
    return this.campaigns.analytics(id);
  }

  @Post()
  @RequirePermission('newsletter_campaign.create')
  @ApiOkResponse({ type: AdminNewsletterCampaignDto })
  create(@Body() dto: CreateCampaignDto): Promise<AdminNewsletterCampaignDto> {
    return this.campaigns.create(dto);
  }

  // No @RequirePermission — stateless render of caller-supplied content, no
  // read/write of any protected resource. Any authenticated admin (still
  // gated by AdminJwtGuard) can preview; used by both the campaign and
  // template editors before either has anything to view/edit permission on.
  @Post('preview')
  previewContent(@Body() dto: PreviewContentDto): { html: string; text: string } {
    return this.campaigns.preview(dto);
  }

  @Patch(':id')
  @RequirePermission('newsletter_campaign.update')
  @ApiOkResponse({ type: AdminNewsletterCampaignDto })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCampaignDto): Promise<AdminNewsletterCampaignDto> {
    return this.campaigns.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('newsletter_campaign.delete')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.campaigns.delete(id);
  }

  @Post(':id/test')
  @RequirePermission('newsletter_campaign.send')
  sendTest(@Param('id', ParseIntPipe) id: number, @Body() dto: SendTestCampaignDto): Promise<{ success: true }> {
    return this.campaigns.sendTest(id, dto.email);
  }

  @Post(':id/send')
  @RequirePermission('newsletter_campaign.send')
  @ApiOkResponse({ type: AdminNewsletterCampaignDto })
  send(@Param('id', ParseIntPipe) id: number): Promise<AdminNewsletterCampaignDto> {
    return this.campaigns.send(id);
  }

  @Post(':id/schedule')
  @RequirePermission('newsletter_campaign.send')
  @ApiOkResponse({ type: AdminNewsletterCampaignDto })
  schedule(@Param('id', ParseIntPipe) id: number, @Body() dto: ScheduleCampaignDto): Promise<AdminNewsletterCampaignDto> {
    return this.campaigns.schedule(id, new Date(dto.scheduledAt));
  }

  @Post(':id/cancel-schedule')
  @RequirePermission('newsletter_campaign.send')
  @ApiOkResponse({ type: AdminNewsletterCampaignDto })
  cancelSchedule(@Param('id', ParseIntPipe) id: number): Promise<AdminNewsletterCampaignDto> {
    return this.campaigns.cancelSchedule(id);
  }
}
