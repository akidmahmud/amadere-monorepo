import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ReviewStatus } from '@amader/db';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { CurrentAdmin } from '../../common/auth/current-admin.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ReviewsService } from './reviews.service';
import { UpdateReviewStatusDto } from './dto/update-review-status.dto';
import { ReplyReviewDto } from './dto/reply-review.dto';

@ApiTags('admin/reviews')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  @RequirePermission('review.view')
  @ApiQuery({ name: 'status', required: false, enum: ReviewStatus })
  list(
    @Query() { page, pageSize }: PaginationQueryDto,
    @Query('status') status?: ReviewStatus,
  ) {
    return this.reviews.adminList(page ?? 1, pageSize ?? 20, status);
  }

  @Patch(':id/status')
  @RequirePermission('review.moderate')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReviewStatusDto,
  ) {
    return this.reviews.updateStatus(id, dto);
  }

  @Post(':id/reply')
  @RequirePermission('review.reply')
  reply(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReplyReviewDto,
    @CurrentAdmin() admin: { id: number },
  ) {
    return this.reviews.reply(id, dto, admin.id);
  }
}
