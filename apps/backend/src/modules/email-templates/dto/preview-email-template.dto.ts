import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

// The (possibly unsaved) draft to preview — falls back to the template's
// currently-saved subject/bodyHtml for whichever field is omitted.
export class PreviewEmailTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bodyHtml?: string;
}
