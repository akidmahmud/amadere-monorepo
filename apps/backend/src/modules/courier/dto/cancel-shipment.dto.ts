import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CancelShipmentDto {
  @ApiProperty({
    description: 'e.g. customer-requested, out-of-stock, address-unreachable',
  })
  @IsString()
  reasonCode!: string;
}
