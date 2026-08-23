import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { DueKind, DueSource } from '@amader/db';

export class CreateDueDto {
  @ApiProperty({ enum: DueKind })
  @IsEnum(DueKind)
  kind!: DueKind;

  @ApiProperty() @IsInt() partyId!: number;

  @ApiProperty({ description: 'Decimal string, greater than zero' })
  @IsString()
  amount!: string;

  @ApiProperty() @IsDateString() issueDate!: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dueDate?: string;

  @ApiPropertyOptional({
    enum: DueSource,
    description: 'Defaults to MANUAL. Generated dues set this themselves.',
  })
  @IsOptional()
  @IsEnum(DueSource)
  source?: DueSource;

  @ApiPropertyOptional() @IsOptional() @IsInt() expenseId?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() orderId?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}
