import { ApiProperty } from '@nestjs/swagger';
import { AdminUserStatus } from '@amader/db';
import { IsArray, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { IsBdPhone } from '../../../common/validators/is-bd-phone.decorator';

export class UpdateAdminUserDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @IsBdPhone()
  phone?: string;

  @ApiProperty({ enum: AdminUserStatus, required: false })
  @IsOptional()
  @IsEnum(AdminUserStatus)
  status?: AdminUserStatus;

  @ApiProperty({ type: [Number], required: false })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  roleIds?: number[];
}
