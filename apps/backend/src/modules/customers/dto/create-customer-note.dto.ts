import { ApiProperty } from '@nestjs/swagger';
import { CustomerNoteType } from '@amader/db';
import { IsEnum, IsString } from 'class-validator';

export class CreateCustomerNoteDto {
  @ApiProperty({ enum: CustomerNoteType })
  @IsEnum(CustomerNoteType)
  type!: CustomerNoteType;

  @ApiProperty()
  @IsString()
  body!: string;
}
