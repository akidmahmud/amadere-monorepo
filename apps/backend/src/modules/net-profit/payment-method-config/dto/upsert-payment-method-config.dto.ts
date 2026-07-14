import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus, PaymentAccountType, PaymentProvider } from '@amader/db';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';

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
  @IsUrl()
  iconUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showIcon?: boolean;

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  orderStatusAfterVerify?: OrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
