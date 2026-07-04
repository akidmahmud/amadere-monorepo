import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreateRedirectDto {
  @ApiProperty({ description: 'e.g. /old-product-slug' })
  @IsString()
  @Matches(/^\//, { message: 'fromPath must start with /' })
  fromPath!: string;

  @ApiProperty({ description: 'e.g. /products/new-product-slug' })
  @IsString()
  @Matches(/^\//, { message: 'toPath must start with /' })
  toPath!: string;

  @ApiPropertyOptional({ default: 301 })
  @IsOptional()
  @IsInt()
  @IsIn([301, 302, 307, 308])
  statusCode?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
