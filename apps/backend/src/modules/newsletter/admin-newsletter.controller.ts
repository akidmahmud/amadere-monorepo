import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { NewsletterService } from './newsletter.service';

@ApiTags('admin/newsletter')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@Controller('admin/newsletter/subscribers')
export class AdminNewsletterController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Get()
  @RequirePermission('newsletter.view')
  list(@Query() { page, pageSize }: PaginationQueryDto) {
    return this.newsletter.adminList(page ?? 1, pageSize ?? 20);
  }
}
