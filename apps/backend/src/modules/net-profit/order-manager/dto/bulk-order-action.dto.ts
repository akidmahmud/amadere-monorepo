import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CourierProviderName } from '@amader/db';
import { ArrayNotEmpty, IsArray, IsEnum, IsInt, IsOptional } from 'class-validator';

export const BULK_ORDER_ACTIONS = ['consign', 'block', 'hold', 'export', 'delete', 'restore', 'assign'] as const;
export type BulkOrderAction = (typeof BULK_ORDER_ACTIONS)[number];

export class BulkOrderActionDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  orderIds!: number[];

  @ApiProperty({ enum: BULK_ORDER_ACTIONS })
  @IsEnum(BULK_ORDER_ACTIONS)
  action!: BulkOrderAction;

  @ApiPropertyOptional({ enum: CourierProviderName, description: 'Required for action=consign' })
  @IsOptional()
  @IsEnum(CourierProviderName)
  courierProvider?: CourierProviderName;

  // Only used/required for action: 'assign' — null unassigns, same
  // convention as BulkCustomerActionDto.assignedAdminId.
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  assignedAdminId?: number | null;
}
