import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { StoreQueryDto } from '../../stores/dto/store.dto';

export class PosCatalogQueryDto extends StoreQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() q?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() code?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;
  @ApiPropertyOptional({ enum: ['popular', 'name', 'price'] })
  @IsOptional()
  @IsIn(['popular', 'name', 'price'])
  sort?: 'popular' | 'name' | 'price';
}

export class PosDateQueryDto extends StoreQueryDto {
  @ApiPropertyOptional({ example: '2026-09-25' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;
}

export class PosRangeQueryDto extends StoreQueryDto {
  @ApiPropertyOptional({ example: '2026-09-01' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from!: string;
  @ApiPropertyOptional({ example: '2026-09-25' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to!: string;
}

export class PosOrdersQueryDto extends StoreQueryDto {
  @ApiPropertyOptional({ enum: ['COMPLETED', 'RETURNED'] })
  @IsOptional()
  @IsIn(['COMPLETED', 'RETURNED'])
  status?: 'COMPLETED' | 'RETURNED';
  @ApiPropertyOptional({ enum: ['CASH', 'CARD', 'MOBILE'] })
  @IsOptional()
  @IsIn(['CASH', 'CARD', 'MOBILE'])
  tender?: 'CASH' | 'CARD' | 'MOBILE';
  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;
  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() q?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class PosCustomersQueryDto extends StoreQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() q?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
