import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaginatedResult } from '@amader/shared';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ApiPaginatedResponse } from '../../common/dto/paginated-response.dto';
import { NewsletterService } from './newsletter.service';
import { NewsletterSubscriberDto } from './newsletter.mapper';

@ApiTags('admin/newsletter')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@Controller('admin/newsletter/subscribers')
export class AdminNewsletterController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Get()
  @RequirePermission('newsletter.view')
  @ApiPaginatedResponse(NewsletterSubscriberDto)
  list(
    @Query() { page, pageSize }: PaginationQueryDto,
  ): Promise<PaginatedResult<NewsletterSubscriberDto>> {
    return this.newsletter.adminList(page ?? 1, pageSize ?? 20);
  }
}
