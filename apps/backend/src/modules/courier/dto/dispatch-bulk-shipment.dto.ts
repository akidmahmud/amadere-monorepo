import { ApiProperty } from '@nestjs/swagger';
import { CourierProviderName } from '@amader/db';
import { ArrayNotEmpty, IsArray, IsEnum, IsInt } from 'class-validator';

export class DispatchBulkShipmentDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  orderIds!: number[];

  @ApiProperty({ enum: CourierProviderName })
  @IsEnum(CourierProviderName)
  provider!: CourierProviderName;
}
