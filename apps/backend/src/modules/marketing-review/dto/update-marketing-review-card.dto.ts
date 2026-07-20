import { PartialType } from '@nestjs/swagger';
import { CreateMarketingReviewCardDto } from './create-marketing-review-card.dto';

export class UpdateMarketingReviewCardDto extends PartialType(CreateMarketingReviewCardDto) {}
