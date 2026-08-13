import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class UpsellStageItemDto {
  @ApiProperty({ enum: ['ITEM_COUNT', 'ORDER_AMOUNT'] })
  @IsIn(['ITEM_COUNT', 'ORDER_AMOUNT'])
  triggerType!: 'ITEM_COUNT' | 'ORDER_AMOUNT';

  @ApiProperty()
  @IsNumber()
  @Min(0)
  triggerValue!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountPercent?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountFixedAmount?: number;

  @ApiProperty()
  @IsBoolean()
  freeShipping!: boolean;

  @ApiProperty()
  @IsString()
  label!: string;

  @ApiProperty()
  @IsInt()
  sortOrder!: number;

  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}

export class UpdateUpsellStagesDto {
  @ApiProperty({ type: [UpsellStageItemDto] })
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => UpsellStageItemDto)
  stages!: UpsellStageItemDto[];
}
