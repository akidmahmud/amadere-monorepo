import { ApiProperty } from '@nestjs/swagger';

// Exists so Swagger emits a schema component the storefront's typegen can
// import — the service's PublicShippingZone is a bare interface and would
// never reach the OpenAPI document.
export class PublicShippingZoneDto {
  @ApiProperty() name!: string;
  @ApiProperty() fee!: number;
  @ApiProperty({ type: String, isArray: true }) districts!: string[];
  @ApiProperty({ description: 'The catch-all row for districts with no zone' })
  isFallback!: boolean;
}
