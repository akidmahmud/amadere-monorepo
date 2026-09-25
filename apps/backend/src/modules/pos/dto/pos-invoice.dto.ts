import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class SavePosInvoiceDto {
  @ApiProperty() @IsString() @MaxLength(100_000) html!: string;
}
