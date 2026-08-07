import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsBdPhone, NormalizeBdPhone } from '../../../common/validators/is-bd-phone.decorator';

export class LoginDto {
  @ApiProperty()
  @NormalizeBdPhone()
  @IsBdPhone()
  phone!: string;

  @ApiProperty()
  @IsString()
  password!: string;
}
