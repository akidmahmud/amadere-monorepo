import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class TransferLineDto {
  @ApiProperty() @IsInt() productId!: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() variantId?: number;
  @ApiProperty() @IsInt() @IsPositive() qty!: number;
}

export class CreateTransferDto {
  @ApiPropertyOptional({ description: 'Source store; defaults to your store' })
  @IsOptional()
  @IsInt()
  fromStoreId?: number;
  @ApiProperty() @IsInt() toStoreId!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;

  @ApiProperty({ type: [TransferLineDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => TransferLineDto)
  items!: TransferLineDto[];
}

export class ReceiveLineDto {
  @ApiProperty() @IsInt() id!: number;
  @ApiProperty() @IsInt() @Min(0) receivedQty!: number;
}

export class ReceiveTransferDto {
  @ApiProperty({ type: [ReceiveLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveLineDto)
  items!: ReceiveLineDto[];
}
