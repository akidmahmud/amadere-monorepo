import { BadRequestException } from '@nestjs/common';
import { OrderAddressType } from '@amader/db';
import { divisionForDistrict } from '@amader/shared';
import { CheckoutAddressDto } from './dto/checkout-address.dto';

// Shared by real checkout and manual (admin-created) orders — both build an
// OrderAddress `create` payload from the same CheckoutAddressDto shape.
// `division` is no longer collected from the client (see
// CheckoutAddressDto's own comment) — every BD district belongs to exactly
// one division, so it's derived here instead. OrderAddress.division is a
// required (non-nullable) column, so an unrecognized district is a real
// error, not something to silently guess at.
export function toOrderAddressCreate(address: CheckoutAddressDto, type: OrderAddressType) {
  // `||`, not `??` — a real bug this fixed: CheckoutForm.tsx's react-hook-form
  // defaultValues still had `division: ""` left over from before the field
  // was removed from the UI, and `??` only falls through on null/undefined,
  // not an empty string — so a real, valid district (e.g. "Rajshahi") was
  // getting rejected with "isn't a recognized Bangladeshi district" purely
  // because `address.division` was "" instead of actually absent.
  const division = address.division || divisionForDistrict(address.district);
  if (!division) {
    throw new BadRequestException(`"${address.district}" isn't a recognized Bangladeshi district`);
  }
  return {
    type,
    recipientName: address.recipientName,
    phone: address.phone,
    alternativePhone: address.alternativePhone,
    email: address.email,
    division,
    district: address.district,
    area: address.area,
    landmark: address.landmark,
    addressLine: address.addressLine,
    postCode: address.postCode,
  };
}
