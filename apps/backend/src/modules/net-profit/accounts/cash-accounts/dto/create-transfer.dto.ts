import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateTransferDto {
  @ApiProperty() @IsInt() fromAccountId!: number;
  @ApiProperty() @IsInt() toAccountId!: number;

  @ApiProperty({ description: 'Decimal string, greater than zero' })
  @IsString()
  amount!: string;

  @ApiProperty() @IsDateString() transferDate!: string;

  @ApiPropertyOptional({ description: 'bKash TrxID, cheque number, bank reference' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}
