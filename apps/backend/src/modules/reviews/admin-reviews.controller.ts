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
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ReviewStatus } from '@amader/db';
import { PaginatedResult } from '@amader/shared';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { CurrentAdmin } from '../../common/auth/current-admin.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ApiPaginatedResponse } from '../../common/dto/paginated-response.dto';
import { ReviewsService } from './reviews.service';
import { UpdateReviewStatusDto } from './dto/update-review-status.dto';
import { ReplyReviewDto } from './dto/reply-review.dto';
import { ReviewDto } from './reviews.mapper';

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
  @ApiPaginatedResponse(ReviewDto)
  list(
    @Query() { page, pageSize }: PaginationQueryDto,
    @Query('status') status?: ReviewStatus,
  ): Promise<PaginatedResult<ReviewDto>> {
    return this.reviews.adminList(page ?? 1, pageSize ?? 20, status);
  }

  @Patch(':id/status')
  @RequirePermission('review.moderate')
  @ApiOkResponse({ type: ReviewDto })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReviewStatusDto,
  ): Promise<ReviewDto> {
    return this.reviews.updateStatus(id, dto);
  }

  @Post(':id/reply')
  @RequirePermission('review.reply')
  @ApiOkResponse({ type: ReviewDto })
  reply(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReplyReviewDto,
    @CurrentAdmin() admin: { id: number },
  ): Promise<ReviewDto> {
    return this.reviews.reply(id, dto, admin.id);
  }
}
