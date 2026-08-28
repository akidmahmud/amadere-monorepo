import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateMediaFolderDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  /** Omit for a top-level folder. */
  @ApiPropertyOptional({ description: 'Create this folder inside another one' })
  @IsOptional()
  @IsInt()
  parentId?: number;
}
