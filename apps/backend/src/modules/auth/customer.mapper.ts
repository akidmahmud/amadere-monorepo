import { Customer } from '@amader/db';

export class CustomerProfileDto {
  id!: number;
  email!: string | null;
  phone!: string | null;
  firstName!: string | null;
  lastName!: string | null;
  dob!: Date | null;
  emailVerifiedAt!: Date | null;
  phoneVerifiedAt!: Date | null;
  /** Whether this account can log in with phone+password — false for an
   * OTP/social-only account, which the profile page uses to show "Set
   * password" instead of "Change password". Never the hash itself. */
  hasPassword!: boolean;
}

export function toCustomerProfileDto(customer: Customer): CustomerProfileDto {
  return {
    id: customer.id,
    email: customer.email,
    phone: customer.phone,
    firstName: customer.firstName,
    lastName: customer.lastName,
    dob: customer.dob,
    emailVerifiedAt: customer.emailVerifiedAt,
    phoneVerifiedAt: customer.phoneVerifiedAt,
    hasPassword: customer.passwordHash !== null,
  };
}
