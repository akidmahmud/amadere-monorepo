import { ApiPropertyOptional } from '@nestjs/swagger';
import { ContentStatus, ProductType, StockStatus } from '@amader/db';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsOptional } from 'class-validator';
import { ProductFilterQueryDto } from './product-filter-query.dto';

/**
 * Ceiling for the admin list's "All" page size.
 *
 * PaginationQueryDto caps every paginated endpoint at 100, which is right for
 * anything a customer can call. The admin products table is a working screen
 * where staff legitimately want the whole catalogue in one scroll (to sort, or
 * to bulk-select), so this one endpoint is allowed more. Still bounded rather
 * than unlimited: an unbounded pageSize is a request anyone with an admin token
 * could use to pull the entire table in one query.
 */
export const ADMIN_PRODUCTS_MAX_PAGE_SIZE = 1000;

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

  /**
   * Return the whole catalogue in one page, ignoring `pageSize`.
   *
   * A flag rather than simply allowing a bigger pageSize: class-validator
   * MERGES a subclass's decorators with the parent's, so re-declaring
   * `pageSize` here with a larger @Max still runs PaginationQueryDto's
   * @Max(100) and rejects the request. This asks for the thing wanted instead
   * of trying to out-argue the inherited constraint.
   */
  @ApiPropertyOptional({
    description: `Return every product in one page, up to ${ADMIN_PRODUCTS_MAX_PAGE_SIZE}, ignoring pageSize.`,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  all?: boolean;
}
