import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsBdPhone } from '../../../common/validators/is-bd-phone.decorator';

export class LoginDto {
  @ApiProperty()
  @IsBdPhone()
  phone!: string;

  @ApiProperty()
  @IsString()
  password!: string;
}
