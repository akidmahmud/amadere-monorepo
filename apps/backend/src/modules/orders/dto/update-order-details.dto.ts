import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrderChannel } from '@amader/db';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsBdPhone, NormalizeBdPhone } from '../../../common/validators/is-bd-phone.decorator';

// The list-view fields (Origin/Phone/Address/Division/Source) that have real
// backing columns but no write path yet — Internal Note already has its own
// endpoint (order-manager module), reused as-is rather than duplicated here.
export class UpdateOrderDetailsDto {
  @ApiPropertyOptional({ enum: OrderChannel, description: 'Origin — how the order was placed' })
  @IsOptional()
  @IsEnum(OrderChannel)
  channel?: OrderChannel;

  // The name on the parcel. Editable for the same reason the address is:
  // it is what the courier calls out on delivery, and a typo taken down over
  // the phone was previously uncorrectable.
  @ApiPropertyOptional({ description: "Shipping address's recipient name" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  recipientName?: string;

  @ApiPropertyOptional({ description: "Shipping address's phone" })
  @IsOptional()
  @NormalizeBdPhone()
  @IsBdPhone()
  phone?: string;

  @ApiPropertyOptional({ description: "Shipping address's address line" })
  @IsOptional()
  @IsString()
  addressLine?: string;

  // district and area matter more than division does: Steadfast is given the
  // district when a parcel is consigned, and until now neither could be
  // corrected on an order at all — only the free-text line and the division.
  // Editing the CUSTOMER's address does not help, because an order carries
  // its own OrderAddress snapshot of where it is actually going.
  @ApiPropertyOptional({ description: "Shipping address's district" })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ description: "Shipping address's thana / area" })
  @IsOptional()
  @IsString()
  area?: string;

  @ApiPropertyOptional({ description: "Shipping address's division" })
  @IsOptional()
  @IsString()
  division?: string;

  @ApiPropertyOptional({ description: 'Campaign attribution — manual override/correction of the checkout-captured value' })
  @IsOptional()
  @IsString()
  utmSource?: string;
}
