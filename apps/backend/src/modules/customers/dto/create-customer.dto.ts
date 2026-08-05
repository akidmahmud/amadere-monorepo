import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IsBdPhone } from '../../../common/validators/is-bd-phone.decorator';

export class CreateCustomerDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @IsBdPhone()
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  // Same upsert-a-CustomerAddress-row pattern as UpdateCustomerDto.addressLine
  // (see CustomersService.createCustomer()) — Customer itself has no address
  // columns.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressLine?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  division?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  district?: string;
}
