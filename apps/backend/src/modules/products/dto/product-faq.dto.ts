import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class ProductFaqDto {
  @ApiProperty()
  @IsString()
  question!: string;

  @ApiProperty()
  @IsString()
  answer!: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
