import { ApiProperty } from '@nestjs/swagger';
import { IsDefined } from 'class-validator';

export class UpsertSettingDto {
  @ApiProperty({
    description: 'Arbitrary JSON value for this setting key',
    type: 'object',
    additionalProperties: true,
  })
  @IsDefined()
  value: unknown;
}
