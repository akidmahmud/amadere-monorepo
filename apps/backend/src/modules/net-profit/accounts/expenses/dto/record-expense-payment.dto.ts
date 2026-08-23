import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString } from 'class-validator';

export class RecordExpensePaymentDto {
  @ApiProperty() @IsString() amount!: string;
  @ApiProperty() @IsDateString() paymentDate!: string;
  @ApiProperty() @IsInt() accountId!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() reference?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}
