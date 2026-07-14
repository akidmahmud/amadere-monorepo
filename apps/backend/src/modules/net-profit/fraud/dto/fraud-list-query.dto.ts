import { ApiPropertyOptional } from '@nestjs/swagger';
import { RiskLevel } from '@amader/db';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export class FraudListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: RiskLevel })
  @IsOptional()
  @IsEnum(RiskLevel)
  risk?: RiskLevel;
}
