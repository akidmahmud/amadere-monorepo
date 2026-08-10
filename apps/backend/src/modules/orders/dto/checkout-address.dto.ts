import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';
import { IsBdPhone, NormalizeBdPhone } from '../../../common/validators/is-bd-phone.decorator';

export class CheckoutAddressDto {
  @ApiProperty()
  @IsString()
  recipientName!: string;

  @ApiProperty()
  @IsString()
  @NormalizeBdPhone()
  @IsBdPhone()
  phone!: string;

  // Steadfast's alternative_phone — a second contact number, optional
  // everywhere `phone` (the primary) is required.
  @ApiPropertyOptional()
  @IsOptional()
  @NormalizeBdPhone()
  @IsBdPhone()
  alternativePhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty()
  @IsString()
  division!: string;

  @ApiProperty()
  @IsString()
  district!: string;

  @ApiProperty({ description: 'Thana/upazila' })
  @IsString()
  area!: string;

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
}
