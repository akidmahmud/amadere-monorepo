import { OrderAddressType } from '@amader/db';
import { CheckoutAddressDto } from './dto/checkout-address.dto';

// Shared by real checkout and manual (admin-created) orders — both build an
// OrderAddress `create` payload from the same CheckoutAddressDto shape.
export function toOrderAddressCreate(address: CheckoutAddressDto, type: OrderAddressType) {
  return {
    type,
    recipientName: address.recipientName,
    phone: address.phone,
    email: address.email,
    division: address.division,
    district: address.district,
    area: address.area,
    landmark: address.landmark,
    addressLine: address.addressLine,
    postCode: address.postCode,
  };
}
