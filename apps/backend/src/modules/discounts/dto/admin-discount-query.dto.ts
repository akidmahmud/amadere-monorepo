import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class AdminDiscountQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search by coupon code' })
  @IsOptional()
  @IsString()
  q?: string;
}
