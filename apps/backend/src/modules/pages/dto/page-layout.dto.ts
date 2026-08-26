import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Locale } from '@amader/db';
import {
  Allow,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class SaveLayoutDto {
  @ApiProperty({ enum: ['EN', 'BN'] })
  @IsEnum({ EN: 'EN', BN: 'BN' })
  locale!: Locale;

  // Not *validated* by class-validator: a Puck document is an arbitrarily
  // deep tree, and the real check is the zod validator at publish time. A
  // draft is deliberately allowed to be incomplete - that is what a draft is.
  //
  // @Allow() is nonetheless required. The global ValidationPipe runs with
  // `whitelist: true`, which strips every property that carries no
  // class-validator decorator - so without this the document was silently
  // removed from the body, the PATCH returned 200 having saved nothing, and
  // publish then failed with "no draft layout saved". @Allow() is exactly the
  // "keep this, don't check it" marker for that case.
  @Allow()
  @ApiProperty({ type: Object, description: 'Puck document (draft).' })
  layout!: unknown;
}

export class PublishLayoutDto {
  @ApiProperty({ enum: ['EN', 'BN'] })
  @IsEnum({ EN: 'EN', BN: 'BN' })
  locale!: Locale;

  @ApiPropertyOptional({ description: 'Label for the revision snapshot.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;
}

export class RestoreRevisionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  revisionId?: number;
}

export class PageRevisionDto {
  id!: number;
  locale!: Locale;
  label!: string | null;
  createdAt!: Date;
  createdBy!: number | null;
}
