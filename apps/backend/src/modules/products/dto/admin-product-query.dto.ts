import { ApiPropertyOptional } from '@nestjs/swagger';
import { ContentStatus, ProductType, StockStatus } from '@amader/db';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { ProductFilterQueryDto } from './product-filter-query.dto';

// Admin-only additions on top of the public/storefront filter set — kept
// separate from ProductFilterQueryDto (shared with the public storefront
// endpoint) so status/stockStatus/date-range never leak into public query
// validation.
export class AdminProductQueryDto extends ProductFilterQueryDto {
  // Lets the Digital Products section (a dedicated admin nav entry, not a
  // filter chip on the main Products page) reuse the same list endpoint
  // instead of forking a parallel one — see useDigitalProducts.ts.
  @ApiPropertyOptional({ enum: ProductType })
  @IsOptional()
  @IsEnum(ProductType)
  productType?: ProductType;

  @ApiPropertyOptional({ enum: ContentStatus })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @ApiPropertyOptional({ enum: StockStatus })
  @IsOptional()
  @IsEnum(StockStatus)
  stockStatus?: StockStatus;

  @ApiPropertyOptional({ description: 'ISO date — products created on/after this date' })
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional({ description: 'ISO date — products created on/before this date' })
  @IsOptional()
  @IsDateString()
  createdTo?: string;
}
