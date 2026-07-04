import { ApiProperty } from '@nestjs/swagger';
import { ReviewStatus } from '@amader/db';
import { IsEnum } from 'class-validator';

export class UpdateReviewStatusDto {
  @ApiProperty({ enum: ReviewStatus })
  @IsEnum(ReviewStatus)
  status!: ReviewStatus;
}
