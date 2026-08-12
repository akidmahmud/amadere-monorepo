import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { EmailTemplatesService } from './email-templates.service';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';
import { UpdateEmailTemplateSettingsDto } from './dto/update-email-template-settings.dto';
import { PreviewEmailTemplateDto } from './dto/preview-email-template.dto';
import { EmailTemplateDto, EmailTemplatePreviewDto, EmailTemplateSettingsDto } from './email-templates.mapper';

@ApiTags('admin/email-templates')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/email-templates')
export class AdminEmailTemplatesController {
  constructor(private readonly emailTemplates: EmailTemplatesService) {}

  @Get()
  @RequirePermission('email_template.view')
  @ApiOkResponse({ type: [EmailTemplateDto] })
  list() {
    return this.emailTemplates.list();
  }

  // Declared before ':key' — NestJS resolves static segments in
  // declaration order, so this must come first or "settings" would be
  // swallowed as a :key value.
  @Get('settings')
  @RequirePermission('email_template.view')
  @ApiOkResponse({ type: EmailTemplateSettingsDto })
  getSettings() {
    return this.emailTemplates.getSettings();
  }

  @Put('settings')
  @RequirePermission('email_template.manage')
  @ApiOkResponse({ type: EmailTemplateSettingsDto })
  updateSettings(@Body() dto: UpdateEmailTemplateSettingsDto) {
    return this.emailTemplates.updateSettings(dto);
  }

  @Get(':key')
  @RequirePermission('email_template.view')
  @ApiOkResponse({ type: EmailTemplateDto })
  get(@Param('key') key: string) {
    return this.emailTemplates.get(key);
  }

  @Patch(':key')
  @RequirePermission('email_template.manage')
  @ApiOkResponse({ type: EmailTemplateDto })
  update(@Param('key') key: string, @Body() dto: UpdateEmailTemplateDto) {
    return this.emailTemplates.update(key, dto);
  }

  @Post(':key/reset')
  @RequirePermission('email_template.manage')
  @ApiOkResponse({ type: EmailTemplateDto })
  reset(@Param('key') key: string) {
    return this.emailTemplates.reset(key);
  }

  @Post(':key/preview')
  @RequirePermission('email_template.view')
  @ApiOkResponse({ type: EmailTemplatePreviewDto })
  preview(@Param('key') key: string, @Body() dto: PreviewEmailTemplateDto) {
    return this.emailTemplates.preview(key, dto);
  }
}
