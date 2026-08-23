import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString } from 'class-validator';

// Descriptive fields only. Amounts are not editable: changing them after
// payments have posted would leave the voucher and the ledger disagreeing.
// Void and re-enter instead.
export class UpdateExpenseDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() categoryId?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() costCentreId?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() mushakChallanNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dueDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() attachmentUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}
