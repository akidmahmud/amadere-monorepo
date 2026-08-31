import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class RestoreCartDto {
  @ApiProperty({ description: "bKash's paymentID, as returned on their redirect back" })
  @IsString()
  @MaxLength(120)
  paymentID!: string;
}
