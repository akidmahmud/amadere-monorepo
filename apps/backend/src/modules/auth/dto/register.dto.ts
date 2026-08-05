import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { IsBdPhone } from '../../../common/validators/is-bd-phone.decorator';

export class RegisterDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty()
  @IsBdPhone()
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string;
}
