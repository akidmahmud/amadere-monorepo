import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsNotEmpty,
  ValidateNested,
} from 'class-validator';

const GROUPS = ['BASE', 'ACL', 'CONTACT', 'ECOMMERCE', 'NEWSLETTER'] as const;

export class ImportEmailTemplateItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  key!: string;

  @ApiProperty({ enum: GROUPS })
  @IsIn(GROUPS)
  group!: (typeof GROUPS)[number];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsString()
  subject!: string;

  @ApiProperty()
  @IsString()
  bodyHtml!: string;

  // Editor hint only — never validated against at render time, so a rough
  // list from an export of a different version is harmless.
  @ApiPropertyOptional({ type: 'array', items: { type: 'object', additionalProperties: true } })
  @IsOptional()
  @IsArray()
  variables?: Record<string, unknown>[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class ImportEmailTemplatesDto {
  @ApiProperty({ type: [ImportEmailTemplateItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportEmailTemplateItemDto)
  templates!: ImportEmailTemplateItemDto[];

  // Off by default: an import that lands on top of existing rows is the
  // dangerous direction (it overwrites wording an admin may have spent time
  // on), so replacing has to be asked for explicitly. With it off, rows that
  // already exist are reported as skipped and left exactly as they are.
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  overwriteExisting?: boolean;
}
