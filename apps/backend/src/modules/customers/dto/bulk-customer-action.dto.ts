import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsEnum, IsInt } from 'class-validator';

export const BULK_CUSTOMER_ACTIONS = ['delete', 'restore'] as const;
export type BulkCustomerAction = (typeof BULK_CUSTOMER_ACTIONS)[number];

export class BulkCustomerActionDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  customerIds!: number[];

  @ApiProperty({ enum: BULK_CUSTOMER_ACTIONS })
  @IsEnum(BULK_CUSTOMER_ACTIONS)
  action!: BulkCustomerAction;
}
