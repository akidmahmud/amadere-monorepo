import { ApiPropertyOptional } from '@nestjs/swagger';
import { DuePartyType, DueStatus } from '@amader/db';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export class DueQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: DuePartyType })
  @IsOptional()
  @IsEnum(DuePartyType)
  partyType?: DuePartyType;

  @ApiPropertyOptional({ enum: DueStatus })
  @IsOptional()
  @IsEnum(DueStatus)
  status?: DueStatus;
}
