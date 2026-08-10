import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { CreateNewsletterTagDto } from './dto/create-tag.dto';
import { NewsletterTagsService } from './newsletter-tags.service';
import { AdminNewsletterTagDto } from './newsletter-tags.mapper';

@ApiTags('admin/newsletter/tags')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/newsletter/tags')
export class AdminNewsletterTagsController {
  constructor(private readonly tags: NewsletterTagsService) {}

  @Get()
  @RequirePermission('newsletter_tag.view')
  @ApiOkResponse({ type: [AdminNewsletterTagDto] })
  list(): Promise<AdminNewsletterTagDto[]> {
    return this.tags.list();
  }

  @Post()
  @RequirePermission('newsletter_tag.create')
  @ApiOkResponse({ type: AdminNewsletterTagDto })
  create(@Body() dto: CreateNewsletterTagDto): Promise<AdminNewsletterTagDto> {
    return this.tags.create(dto);
  }

  @Delete(':id')
  @RequirePermission('newsletter_tag.delete')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.tags.delete(id);
  }
}
