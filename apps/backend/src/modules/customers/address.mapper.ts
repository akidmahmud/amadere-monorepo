import { CustomerAddress } from '@amader/db';

export class AddressDto {
  id!: number;
  label!: string | null;
  recipientName!: string;
  phone!: string;
  division!: string;
  district!: string;
  area!: string | null;
  landmark!: string | null;
  addressLine!: string;
  postCode!: string | null;
  isDefault!: boolean;
}

export function toAddressDto(address: CustomerAddress): AddressDto {
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
