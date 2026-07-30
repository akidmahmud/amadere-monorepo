import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrderChannel } from '@amader/db';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { IsBdPhone } from '../../../common/validators/is-bd-phone.decorator';

// The list-view fields (Origin/Phone/Address/Division/Source) that have real
// backing columns but no write path yet — Internal Note already has its own
// endpoint (order-manager module), reused as-is rather than duplicated here.
export class UpdateOrderDetailsDto {
  @ApiPropertyOptional({ enum: OrderChannel, description: 'Origin — how the order was placed' })
  @IsOptional()
  @IsEnum(OrderChannel)
  channel?: OrderChannel;

  @ApiPropertyOptional({ description: "Shipping address's phone" })
  @IsOptional()
  @IsBdPhone()
  phone?: string;

  @ApiPropertyOptional({ description: "Shipping address's address line" })
  @IsOptional()
  @IsString()
  addressLine?: string;

  @ApiPropertyOptional({ description: "Shipping address's division" })
  @IsOptional()
  @IsString()
  division?: string;

  @ApiPropertyOptional({ description: 'Campaign attribution — manual override/correction of the checkout-captured value' })
  @IsOptional()
  @IsString()
  utmSource?: string;
}
