import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

// Not translatable — same images regardless of locale. Lives on Product
// itself; paired text (headings/captions) lives in ProductInfoVisualContentDto
// on each ProductTranslation instead.
export class ProductInfoVisualImagesDto {
  @ApiPropertyOptional({ description: 'Center product image' })
  @IsOptional()
  @IsString()
  main?: string;

  @ApiPropertyOptional({ type: [String], description: 'Exactly 3 circular ingredient images' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  circles?: string[];
}

export class ProductInfoVisualArrowDto {
  @ApiPropertyOptional({ description: 'Admin-authored HTML, same trust level as description/content' })
  @IsOptional()
  @IsString()
  heading?: string;

  @ApiPropertyOptional({ description: 'Admin-authored HTML, same trust level as description/content' })
  @IsOptional()
  @IsString()
  subheading?: string;
}

// One per ProductTranslation (EN/BN) — the 4 arrows are fixed by position
// (index 0-3 = top-left, bottom-left, top-right, bottom-right), not by name.
export class ProductInfoVisualContentDto {
  @ApiPropertyOptional({ description: 'Admin-authored HTML, same trust level as description/content' })
  @IsOptional()
  @IsString()
  topHeading?: string;

  @ApiPropertyOptional({ description: 'Admin-authored HTML, same trust level as description/content' })
  @IsOptional()
  @IsString()
  bottomHeading?: string;

  @ApiPropertyOptional({ type: [ProductInfoVisualArrowDto], description: 'Exactly 4, in fixed position order' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductInfoVisualArrowDto)
  arrows?: ProductInfoVisualArrowDto[];

  @ApiPropertyOptional({ type: [String], description: 'Exactly 3, matching Product.infoVisualImages.circles order' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  circleLabels?: string[];
}
