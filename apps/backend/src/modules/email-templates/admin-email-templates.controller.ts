import { Body, Controller, Get, Param, Patch, Post, Put, Query, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { EmailTemplatesService } from './email-templates.service';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';
import { UpdateEmailTemplateSettingsDto } from './dto/update-email-template-settings.dto';
import { PreviewEmailTemplateDto } from './dto/preview-email-template.dto';
import { ImportEmailTemplatesDto } from './dto/import-email-templates.dto';
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

  // Same declaration-order rule as 'settings' below — 'export' and 'import'
  // are static segments and must precede the ':key' route.
  // Served as a real file download (Content-Disposition), not a JSON body
  // the client turns into a Blob. A blob download saved as a bare object-URL
  // id with no extension and didn't register properly in the browser's
  // download manager; a normal HTTP attachment does, and "Show in folder"
  // works. Content-Type is deliberately NOT application/json — the admin
  // proxy passes a response through raw only when it isn't JSON (it would
  // otherwise re-serialize it and drop the filename header).
  //
  // `keys` (comma-separated) exports just those templates; omit it for all.
  @Get('export')
  @RequirePermission('email_template.view')
  async export(@Query('keys') keys: string | undefined, @Res() res: Response) {
    const wanted = keys
      ? keys.split(',').map((k) => k.trim()).filter(Boolean)
      : undefined;
    const payload = await this.emailTemplates.exportAll(wanted);
    const stamp = new Date().toISOString().slice(0, 10);
    const name =
      wanted && wanted.length === 1
        ? `email-template-${wanted[0]}-${stamp}.json`
        : `email-templates-${stamp}.json`;
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.send(JSON.stringify(payload, null, 2));
  }

  @Post('import')
  @RequirePermission('email_template.manage')
  import(@Body() dto: ImportEmailTemplatesDto) {
    return this.emailTemplates.import(dto.templates, dto.overwriteExisting ?? false);
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
