import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { NewsletterSegmentType } from '@amader/db';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateSegmentDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ enum: NewsletterSegmentType })
  @IsEnum(NewsletterSegmentType)
  type!: NewsletterSegmentType;

  @ApiPropertyOptional({ description: 'Required when type = TAG' })
  @IsOptional()
  @IsInt()
  tagId?: number;

  @ApiPropertyOptional({ description: 'Required when type = NEW_SUBSCRIBERS — subscribed within this many days' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  days?: number;
}
