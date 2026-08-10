import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { NewsletterTemplatesService } from './newsletter-templates.service';
import { AdminNewsletterTemplateDto } from './newsletter-templates.mapper';

@ApiTags('admin/newsletter/templates')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/newsletter/templates')
export class AdminNewsletterTemplatesController {
  constructor(private readonly templates: NewsletterTemplatesService) {}

  @Get()
  @RequirePermission('newsletter_template.view')
  @ApiOkResponse({ type: [AdminNewsletterTemplateDto] })
  list(): Promise<AdminNewsletterTemplateDto[]> {
    return this.templates.list();
  }

  @Get(':id')
  @RequirePermission('newsletter_template.view')
  @ApiOkResponse({ type: AdminNewsletterTemplateDto })
  get(@Param('id', ParseIntPipe) id: number): Promise<AdminNewsletterTemplateDto> {
    return this.templates.get(id);
  }

  @Post()
  @RequirePermission('newsletter_template.create')
  @ApiOkResponse({ type: AdminNewsletterTemplateDto })
  create(@Body() dto: CreateTemplateDto): Promise<AdminNewsletterTemplateDto> {
    return this.templates.create(dto);
  }

  @Post(':id/duplicate')
  @RequirePermission('newsletter_template.create')
  @ApiOkResponse({ type: AdminNewsletterTemplateDto })
  duplicate(@Param('id', ParseIntPipe) id: number): Promise<AdminNewsletterTemplateDto> {
    return this.templates.duplicate(id);
  }

  @Patch(':id')
  @RequirePermission('newsletter_template.update')
  @ApiOkResponse({ type: AdminNewsletterTemplateDto })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTemplateDto): Promise<AdminNewsletterTemplateDto> {
    return this.templates.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('newsletter_template.delete')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.templates.delete(id);
  }
}
