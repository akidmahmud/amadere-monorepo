import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class AdminTagQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Case-insensitive substring match on tag name' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description:
      'Comma-separated tag ids — batch-resolves specific tags (e.g. a product\'s assigned tags that fall outside the picker\'s first-100 page) in one request instead of one GET per id. Ignores page/pageSize/q when set.',
  })
  @IsOptional()
  @IsString()
  ids?: string;
}
