import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateExpenseDto {
  @ApiProperty()
  @IsDateString()
  expenseDate!: string;

  @ApiProperty({ description: 'Free text — e.g. Rent, Salaries, Packaging, Courier, Software' })
  @IsString()
  category!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({ default: false, description: 'Counts as input VAT in the VAT summary' })
  @IsOptional()
  @IsBoolean()
  isVatInput?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
