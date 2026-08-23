import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../../../common/dto/pagination-query.dto';

export class ExpenseQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() categoryId?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() costCentreId?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() partyId?: number;

  @ApiPropertyOptional({
    enum: ['PAID', 'PARTIAL', 'UNPAID'],
    description: 'Derived from the ledger, not a stored column',
  })
  @IsOptional()
  @IsIn(['PAID', 'PARTIAL', 'UNPAID'])
  paymentStatus?: 'PAID' | 'PARTIAL' | 'UNPAID';

  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;

  @ApiPropertyOptional({ description: 'Matches voucher number, note or payee name' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeVoided?: boolean;
}
