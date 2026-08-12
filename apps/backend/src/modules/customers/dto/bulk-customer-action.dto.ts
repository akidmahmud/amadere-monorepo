import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsEnum, IsInt, IsOptional } from 'class-validator';

export const BULK_CUSTOMER_ACTIONS = ['delete', 'restore', 'assign'] as const;
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

  // Only used/required for action: 'assign' — the staff member to assign all
  // selected customers to. null unassigns (matches the single-row "—" option
  // in CustomersTable's own inline select).
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  assignedAdminId?: number | null;
}
