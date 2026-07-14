import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentAccountType, PaymentProvider } from '@amader/db';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpsertPaymentMethodConfigDto {
  @ApiProperty({ enum: PaymentProvider })
  @IsEnum(PaymentProvider)
  provider!: PaymentProvider;

  @ApiProperty({ enum: PaymentAccountType })
  @IsEnum(PaymentAccountType)
  accountType!: PaymentAccountType;

  @ApiProperty()
  @IsString()
  number!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instructionsEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instructionsBn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
