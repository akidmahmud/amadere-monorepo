import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsBdPhone, NormalizeBdPhone } from '../../../common/validators/is-bd-phone.decorator';

export class TrackOrderDto {
  @ApiProperty()
  @IsString()
  orderNumber!: string;

  @ApiProperty({ description: 'Phone number used on the shipping address' })
  @IsString()
  @NormalizeBdPhone()
  @IsBdPhone()
  phone!: string;
}
