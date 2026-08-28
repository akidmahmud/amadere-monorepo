import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CancelIncompleteOrderDto {
  /**
   * Why staff gave up on this cart. Required — a cancellation with no reason
   * is indistinguishable from a delete, and the reason is the entire point of
   * recording the cancellation instead of removing the row.
   *
   * Declared here rather than read off a loose body: the global
   * ValidationPipe runs with `whitelist: true`, which silently strips any
   * property no DTO declares. An undeclared `reason` would arrive as
   * undefined and the endpoint would "succeed" while saving nothing.
   */
  @ApiProperty({ maxLength: 500 })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}
