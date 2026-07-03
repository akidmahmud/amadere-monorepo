import { ApiProperty } from '@nestjs/swagger';
import { Locale } from '@amader/db';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsString,
  ValidateNested,
} from 'class-validator';

export class SynonymTermDto {
  @ApiProperty({ enum: Locale })
  @IsEnum(Locale)
  locale!: Locale;

  @ApiProperty()
  @IsString()
  term!: string;
}

export class CreateSynonymGroupDto {
  @ApiProperty({
    type: [SynonymTermDto],
    description:
      'e.g. [{locale:EN,term:"Chatu"},{locale:EN,term:"Sattu"},{locale:BN,term:"ছাতু"}]',
  })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => SynonymTermDto)
  terms!: SynonymTermDto[];
}

export class UpdateSynonymGroupDto extends CreateSynonymGroupDto {}
