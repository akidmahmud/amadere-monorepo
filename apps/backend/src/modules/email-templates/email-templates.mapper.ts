import { ApiProperty } from '@nestjs/swagger';
import { EmailTemplate, EmailTemplateGroup } from '@amader/db';

export interface EmailTemplateVariable {
  key: string;
  description: string;
}

export class EmailTemplateDto {
  @ApiProperty() id!: number;
  @ApiProperty() key!: string;
  @ApiProperty({ enum: EmailTemplateGroup }) group!: EmailTemplateGroup;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty() subject!: string;
  @ApiProperty() bodyHtml!: string;
  @ApiProperty() defaultSubject!: string;
  @ApiProperty() defaultBodyHtml!: string;
  @ApiProperty({ type: [Object] }) variables!: EmailTemplateVariable[];
  @ApiProperty() canDisable!: boolean;
  @ApiProperty() enabled!: boolean;
}

export function toEmailTemplateDto(row: EmailTemplate): EmailTemplateDto {
  return {
    id: row.id,
    key: row.key,
    group: row.group,
    title: row.title,
    description: row.description,
    subject: row.subject,
    bodyHtml: row.bodyHtml,
    defaultSubject: row.defaultSubject,
    defaultBodyHtml: row.defaultBodyHtml,
    variables: row.variables as unknown as EmailTemplateVariable[],
    canDisable: row.canDisable,
    enabled: row.enabled,
  };
}

export class EmailTemplateSettingsDto {
  @ApiProperty({ nullable: true }) logoMediaId!: number | null;
  @ApiProperty({ nullable: true }) logoUrl!: string | null;
  @ApiProperty() contactEmail!: string;
  @ApiProperty() copyright!: string;
  @ApiProperty() logoHeight!: number;
  @ApiProperty() customCss!: string;
  @ApiProperty() orderNotificationEmail!: string;
}

export class EmailTemplatePreviewDto {
  @ApiProperty() subject!: string;
  @ApiProperty() html!: string;
}
