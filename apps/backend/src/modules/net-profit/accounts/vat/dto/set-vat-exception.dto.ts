import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, Max, Min, ValidateIf } from 'class-validator';

export class SetVatExceptionDto {
  /**
   * Percent. `null` removes the exception and returns the product to the
   * store rate — deliberately distinct from `0`, which means the product is
   * explicitly zero-rated.
   *
   * `@ValidateIf` rather than `@IsOptional`: `@IsOptional` skips validation
   * for null as well as undefined, which would let anything through as
   * "null". Declared on a DTO at all because the global ValidationPipe runs
   * with `whitelist: true` and silently drops undeclared properties.
   */
  @ApiPropertyOptional({ minimum: 0, maximum: 100, nullable: true })
  @ValidateIf((_o, value) => value !== null && value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  ratePercent!: number | null;
}
