import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { PromoVideoSource } from '@amader/db';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class CreatePromoVideoDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty({ enum: PromoVideoSource })
  @IsEnum(PromoVideoSource)
  source!: PromoVideoSource;

  @ApiProperty()
  @IsUrl({ require_tld: false })
  url!: string;

  @ApiPropertyOptional({ description: 'Shown as the duration badge in the video list — no source here exposes a free/reliable duration API, so this is admin-entered.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  durationSeconds?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  productId?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  showInHomepage?: boolean;
}
