import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator';

export class CustomerTierItemDto {
  @ApiProperty()
  @IsString()
  label!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  minCompletedOrders!: number;

  @ApiProperty()
  @IsInt()
  sortOrder!: number;
}

export class UpdateCustomerTiersDto {
  @ApiProperty({ type: [CustomerTierItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomerTierItemDto)
  tiers!: CustomerTierItemDto[];
}
