import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    type: [String],
    required: false,
    example: ['product.create', 'order.view'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionKeys?: string[];
}
