import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { DueKind, DueSource } from '@amader/db';
import { PaginationQueryDto } from '../../../../../common/dto/pagination-query.dto';

export class DueQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: DueKind })
  @IsOptional()
  @IsEnum(DueKind)
  kind?: DueKind;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() partyId?: number;

  @ApiPropertyOptional({ enum: DueSource })
  @IsOptional()
  @IsEnum(DueSource)
  source?: DueSource;

  @ApiPropertyOptional({
    enum: ['PENDING', 'PARTIALLY_PAID', 'PAID'],
    description: 'Derived from the ledger, not a stored column',
  })
  @IsOptional()
  @IsIn(['PENDING', 'PARTIALLY_PAID', 'PAID'])
  status?: 'PENDING' | 'PARTIALLY_PAID' | 'PAID';

  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;

  @ApiPropertyOptional({ description: 'Matches doc number, note or party name' })
  @IsOptional()
  @IsString()
  q?: string;
}
