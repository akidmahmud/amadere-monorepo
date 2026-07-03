import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SearchQueryDto {
  @ApiProperty({ description: 'Search text, e.g. "chatu" or "ছাতু"' })
  @IsString()
  @MinLength(2)
  q!: string;
}
