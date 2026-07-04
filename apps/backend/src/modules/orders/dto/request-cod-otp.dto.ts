import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RequestCodOtpDto {
  @ApiProperty({
    description: 'Shipping phone number the order will be placed under',
  })
  @IsString()
  phone!: string;
}
