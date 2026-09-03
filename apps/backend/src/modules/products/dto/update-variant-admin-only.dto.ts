import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateVariantAdminOnlyDto {
  @ApiProperty({
    description:
      'Live for staff, hidden from the storefront. Toggling this on removes the variant from the PDP, search, wishlist cards and the catalog feed, excludes its stock from the parent product\'s public "in stock" status, and blocks customers from adding it to a cart. Staff can still sell it from the admin.',
  })
  @IsBoolean()
  isAdminOnly!: boolean;
}
