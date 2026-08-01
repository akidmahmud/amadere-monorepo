import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentProvider } from '@amader/db';
import { IsEnum, IsOptional } from 'class-validator';
import { LocaleQueryDto } from '../../../common/dto/locale-query.dto';

export class CartQueryDto extends LocaleQueryDto {
  // Optional — the checkout page passes whatever payment method the
  // customer currently has selected so the previewed total (including COD
  // fee, when enabled) matches what they'll actually be charged. Omitted
  // elsewhere (mini-cart, cart drawer) where no method has been chosen yet.
  @ApiPropertyOptional({ enum: PaymentProvider })
  @IsOptional()
  @IsEnum(PaymentProvider)
  paymentProvider?: PaymentProvider;
}
