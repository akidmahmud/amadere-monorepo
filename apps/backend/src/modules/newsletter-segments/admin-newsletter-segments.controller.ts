import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { CreateSegmentDto } from './dto/create-segment.dto';
import { UpdateSegmentDto } from './dto/update-segment.dto';
import { NewsletterSegmentsService } from './newsletter-segments.service';
import { AdminNewsletterSegmentDto } from './newsletter-segments.mapper';

@ApiTags('admin/newsletter/segments')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/newsletter/segments')
export class AdminNewsletterSegmentsController {
  constructor(private readonly segments: NewsletterSegmentsService) {}

  @Get()
  @RequirePermission('newsletter_segment.view')
  @ApiOkResponse({ type: [AdminNewsletterSegmentDto] })
  list(): Promise<AdminNewsletterSegmentDto[]> {
    return this.segments.list();
  }

  @Get(':id')
  @RequirePermission('newsletter_segment.view')
  @ApiOkResponse({ type: AdminNewsletterSegmentDto })
  get(@Param('id', ParseIntPipe) id: number): Promise<AdminNewsletterSegmentDto> {
    return this.segments.get(id);
  }

  @Get(':id/count')
  @RequirePermission('newsletter_segment.view')
  count(@Param('id', ParseIntPipe) id: number): Promise<{ count: number }> {
    return this.segments.count(id);
  }

  @Post()
  @RequirePermission('newsletter_segment.create')
  @ApiOkResponse({ type: AdminNewsletterSegmentDto })
  create(@Body() dto: CreateSegmentDto): Promise<AdminNewsletterSegmentDto> {
    return this.segments.create(dto);
  }

  @Patch(':id')
  @RequirePermission('newsletter_segment.update')
  @ApiOkResponse({ type: AdminNewsletterSegmentDto })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSegmentDto): Promise<AdminNewsletterSegmentDto> {
    return this.segments.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('newsletter_segment.delete')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.segments.delete(id);
  }
}
