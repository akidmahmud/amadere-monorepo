import { CustomerAddress } from '@amader/db';

export function toAddressDto(address: CustomerAddress) {
  return {
    id: address.id,
    label: address.label,
    recipientName: address.recipientName,
    phone: address.phone,
    division: address.division,
    district: address.district,
    area: address.area,
    landmark: address.landmark,
    addressLine: address.addressLine,
    postCode: address.postCode,
    isDefault: address.isDefault,
  };
}
