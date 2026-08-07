import { ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerBehaviour, CustomerCrmStatus, CustomerPriority } from '@amader/db';
import { IsBoolean, IsDateString, IsEmail, IsEnum, IsInt, IsOptional, IsString, IsUrl } from 'class-validator';
import { IsBdPhone, NormalizeBdPhone } from '../../../common/validators/is-bd-phone.decorator';

export class UpdateCustomerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  // Uniqueness is enforced in CustomersService.adminUpdate() (a friendly
  // ConflictException, matching createCustomer()) rather than here — class
  // validators can't see other rows. Editing this changes which future
  // guest-checkout orders auto-match to this customer (upsert-by-phone in
  // customer-order-event.listener.ts), not just a display value.
  @ApiPropertyOptional()
  @IsOptional()
  @NormalizeBdPhone()
  @IsBdPhone()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  // No `address` column exists on Customer — this upserts the customer's
  // default CustomerAddress row (creating one if none exists yet). See
  // CustomersService.adminUpdate().
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressLine?: string;

  @ApiPropertyOptional({ description: 'Birthday, ISO date, or null to clear' })
  @IsOptional()
  @IsDateString()
  dob?: string | null;

  // ---- Sales-team CRM fields ----

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;

  @ApiPropertyOptional({ description: 'Admin staff user ID, or null to unassign' })
  @IsOptional()
  @IsInt()
  assignedAdminId?: number | null;

  @ApiPropertyOptional({ description: 'ISO date, or null to clear' })
  @IsOptional()
  @IsDateString()
  nextCallTarget?: string | null;

  @ApiPropertyOptional({ description: 'Follow-up cadence in days (7/15/30), or null to clear' })
  @IsOptional()
  @IsInt()
  followUpCadenceDays?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasNewOrder?: boolean;

  @ApiPropertyOptional({ description: 'ISO date, or null to clear' })
  @IsOptional()
  @IsDateString()
  newOrderAt?: string | null;

  @ApiPropertyOptional({ enum: CustomerPriority })
  @IsOptional()
  @IsEnum(CustomerPriority)
  priority?: CustomerPriority | null;

  @ApiPropertyOptional({ enum: CustomerCrmStatus })
  @IsOptional()
  @IsEnum(CustomerCrmStatus)
  crmStatus?: CustomerCrmStatus | null;

  @ApiPropertyOptional({ enum: CustomerBehaviour })
  @IsOptional()
  @IsEnum(CustomerBehaviour)
  behaviour?: CustomerBehaviour | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerFeedback?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  amaderFeedback?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  familyDetails?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  purchaseReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  facebookProfileUrl?: string;
}
