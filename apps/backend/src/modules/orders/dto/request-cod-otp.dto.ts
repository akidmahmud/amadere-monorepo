import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsBdPhone, NormalizeBdPhone } from '../../../common/validators/is-bd-phone.decorator';

export class RequestCodOtpDto {
  @ApiProperty({
    description: 'Shipping phone number the order will be placed under',
  })
  @IsString()
  @NormalizeBdPhone()
  @IsBdPhone()
  phone!: string;
}
