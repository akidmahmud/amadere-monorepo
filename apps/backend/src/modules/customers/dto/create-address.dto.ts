import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { IsBdPhone } from '../../../common/validators/is-bd-phone.decorator';

export class CreateAddressDto {
  @ApiPropertyOptional({ description: 'e.g. "Home", "Office"' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty()
  @IsString()
  recipientName!: string;

  @ApiProperty()
  @IsString()
  @IsBdPhone()
  phone!: string;

  @ApiProperty()
  @IsString()
  division!: string;

  @ApiProperty()
  @IsString()
  district!: string;

  @ApiPropertyOptional({ description: 'Thana/upazila' })
  @IsOptional()
  @IsString()
  area?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  landmark?: string;

  @ApiProperty()
  @IsString()
  addressLine!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postCode?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
