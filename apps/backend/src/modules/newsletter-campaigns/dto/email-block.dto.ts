import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsObject } from 'class-validator';
import type { EmailBlockType } from '../../../common/newsletter/email-renderer.util';

const BLOCK_TYPES: EmailBlockType[] = ['heading', 'text', 'image', 'button', 'divider', 'spacer'];

export class EmailBlockDto {
  @ApiProperty({ enum: BLOCK_TYPES })
  @IsIn(BLOCK_TYPES)
  type!: EmailBlockType;

  @ApiProperty({ type: Object })
  @IsObject()
  content!: Record<string, unknown>;
}
