import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

/** Exactly the shape a browser's PushSubscription.toJSON() produces, so the
 *  storefront can post what the API handed it without reshaping. */
export class SubscribePushDto {
  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  endpoint!: string;

  @ApiProperty({ description: 'subscription.keys.p256dh' })
  @IsString()
  @MaxLength(400)
  p256dh!: string;

  @ApiProperty({ description: 'subscription.keys.auth' })
  @IsString()
  @MaxLength(400)
  auth!: string;

  @ApiPropertyOptional({ description: 'Links the browser to a known customer when there is one' })
  @IsOptional()
  @IsInt()
  customerId?: number;

  @ApiPropertyOptional({
    description:
      "The visitor's cart guest token. This is what makes abandoned-cart push " +
      'reachable for a shopper who has not signed in.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  guestToken?: string;

  @ApiPropertyOptional({ enum: ['EN', 'BN'] })
  @IsOptional()
  @IsString()
  locale?: string;
}

export class UnsubscribePushDto {
  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  endpoint!: string;
}

export class UpdatePushKeysDto {
  @ApiPropertyOptional({ description: 'VAPID public key. Blank leaves the stored one alone.' })
  @IsOptional()
  @IsString()
  publicKey?: string;

  @ApiPropertyOptional({ description: 'VAPID private key. Write-only, never returned.' })
  @IsOptional()
  @IsString()
  privateKey?: string;

  @ApiPropertyOptional({ description: 'mailto: or https: URL push services can contact' })
  @IsOptional()
  @IsString()
  subject?: string;
}

export class SendTestPushDto {
  @ApiProperty({ description: 'Endpoint to send the test to' })
  @IsString()
  endpoint!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  body?: string;
}

export class RegisterStockAlertDto {
  @ApiProperty()
  @IsInt()
  productId!: number;

  @ApiPropertyOptional({ description: 'Omit for a simple (non-variant) product' })
  @IsOptional()
  @IsInt()
  variantId?: number;

  @ApiProperty({ description: "The browser's push endpoint — this is the address the alert is sent to" })
  @IsString()
  @MaxLength(2000)
  endpoint!: string;

  @ApiPropertyOptional({ enum: ['EN', 'BN'] })
  @IsOptional()
  @IsString()
  locale?: string;
}
