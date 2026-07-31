import { Body, Controller, Get, Post, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { EmailSettingsService } from './email-settings.service';
import { UpdateEmailSettingsDto } from './dto/update-email-settings.dto';
import { SmtpEmailProvider } from '../net-profit/cart-campaigns/providers/smtp-email.provider';

class SendTestEmailDto {
  @ApiProperty()
  @IsEmail()
  to!: string;
}

@ApiTags('admin/email-settings')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/email-settings')
export class AdminEmailSettingsController {
  constructor(
    private readonly settings: EmailSettingsService,
    private readonly smtp: SmtpEmailProvider,
  ) {}

  @Get()
  @RequirePermission('email_settings.view')
  get() {
    return this.settings.getConfig();
  }

  @Put()
  @RequirePermission('email_settings.manage')
  update(@Body() dto: UpdateEmailSettingsDto) {
    return this.settings.updateConfig(dto);
  }

  @Post('test')
  @RequirePermission('email_settings.manage')
  async sendTest(@Body() dto: SendTestEmailDto) {
    const result = await this.smtp.send(
      dto.to,
      'Amader — test email',
      'This is a test email from your Amader admin Email settings. If you received this, SMTP is configured correctly.',
    );
    return result.failed ? { success: false, message: result.error } : { success: true, message: `Sent (id: ${result.id})` };
  }
}
