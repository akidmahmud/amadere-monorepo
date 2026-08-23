import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { PartyRole } from '@amader/db';
import { PaginationQueryDto } from '../../../../../common/dto/pagination-query.dto';

export class PartyQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Case-insensitive substring match on name or phone' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: PartyRole })
  @IsOptional()
  @IsEnum(PartyRole)
  role?: PartyRole;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isActive?: boolean;
}
