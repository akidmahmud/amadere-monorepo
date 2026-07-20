import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { MarketingReviewService } from './marketing-review.service';
import { PublicMarketingReviewCardDto } from './marketing-review.mapper';

@ApiTags('marketing-review')
@Controller('marketing-review-cards')
export class MarketingReviewController {
  constructor(private readonly marketingReview: MarketingReviewService) {}

  @Get()
  @ApiOkResponse({ type: PublicMarketingReviewCardDto, isArray: true })
  list(@Query() { locale }: LocaleQueryDto): Promise<PublicMarketingReviewCardDto[]> {
    return this.marketingReview.publicList(locale ?? 'EN');
  }
}
