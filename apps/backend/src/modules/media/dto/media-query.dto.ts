import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class MediaQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Only media inside this folder' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  folderId?: number;

  @ApiPropertyOptional({ description: 'Only media not assigned to any folder — ignored if folderId is set' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unfiled?: boolean;
}
