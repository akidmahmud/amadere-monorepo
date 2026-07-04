import { ApiProperty } from '@nestjs/swagger';
import { CourierProviderName } from '@amader/db';
import { IsEnum, IsInt } from 'class-validator';

export class DispatchShipmentDto {
  @ApiProperty()
  @IsInt()
  orderId!: number;

  @ApiProperty({ enum: CourierProviderName })
  @IsEnum(CourierProviderName)
  provider!: CourierProviderName;
}
