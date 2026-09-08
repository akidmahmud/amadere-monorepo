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

  // Nullable on purpose: Prisma reads `undefined` in an update as "leave
  // unchanged", so omitting this could never clear a thumbnail — removing one
  // in the admin would silently keep the old image. `@IsOptional()` skips
  // validation for null as well as undefined, so an explicit null clears it.
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  thumbnailUrl?: string | null;

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
