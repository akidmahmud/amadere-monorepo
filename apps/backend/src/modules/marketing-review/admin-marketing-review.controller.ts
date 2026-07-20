import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { MarketingReviewService } from './marketing-review.service';
import { CreateMarketingReviewCardDto } from './dto/create-marketing-review-card.dto';
import { UpdateMarketingReviewCardDto } from './dto/update-marketing-review-card.dto';
import { AdminMarketingReviewCardDto } from './marketing-review.mapper';

@ApiTags('admin/marketing-review')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/marketing-review-cards')
export class AdminMarketingReviewController {
  constructor(private readonly marketingReview: MarketingReviewService) {}

  @Get()
  @RequirePermission('marketing_review.view')
  @ApiOkResponse({ type: AdminMarketingReviewCardDto, isArray: true })
  list(): Promise<AdminMarketingReviewCardDto[]> {
    return this.marketingReview.adminList();
  }

  @Get(':id')
  @RequirePermission('marketing_review.view')
  @ApiOkResponse({ type: AdminMarketingReviewCardDto })
  get(@Param('id', ParseIntPipe) id: number): Promise<AdminMarketingReviewCardDto> {
    return this.marketingReview.adminGet(id);
  }

  @Post()
  @RequirePermission('marketing_review.create')
  @ApiOkResponse({ type: AdminMarketingReviewCardDto })
  create(@Body() dto: CreateMarketingReviewCardDto): Promise<AdminMarketingReviewCardDto> {
    return this.marketingReview.create(dto);
  }

  @Patch(':id')
  @RequirePermission('marketing_review.update')
  @ApiOkResponse({ type: AdminMarketingReviewCardDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMarketingReviewCardDto,
  ): Promise<AdminMarketingReviewCardDto> {
    return this.marketingReview.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('marketing_review.delete')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.marketingReview.delete(id);
  }
}
