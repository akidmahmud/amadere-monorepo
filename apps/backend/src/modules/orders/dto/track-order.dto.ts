import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class TrackOrderDto {
  @ApiProperty()
  @IsString()
  orderNumber!: string;

  @ApiProperty({ description: 'Phone number used on the shipping address' })
  @IsString()
  phone!: string;
}
