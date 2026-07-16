import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContentStatus } from '@amader/db';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { NameDescriptionTranslationDto } from '../../../common/dto/name-description-translation.dto';

export class CreateCollectionProductDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  productId!: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateCollectionDto {
  @ApiProperty()
  @IsString()
  slug!: string;

  @ApiPropertyOptional({ enum: ContentStatus, default: ContentStatus.DRAFT })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ default: false, description: 'Show this collection as a top-level navbar link.' })
  @IsOptional()
  @IsBoolean()
  showInNav?: boolean;

  @ApiProperty({ type: [NameDescriptionTranslationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => NameDescriptionTranslationDto)
  translations!: NameDescriptionTranslationDto[];

  @ApiPropertyOptional({ type: [CreateCollectionProductDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCollectionProductDto)
  products?: CreateCollectionProductDto[];
}
