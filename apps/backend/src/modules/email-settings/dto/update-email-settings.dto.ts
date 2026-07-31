import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { SmtpEncryption } from '../email-settings.service';

const ENCRYPTIONS: SmtpEncryption[] = ['none', 'tls', 'ssl'];

export class UpdateEmailSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'e.g. smtp.gmail.com' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  host?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  username?: string;

  @ApiPropertyOptional({ description: 'Leave blank to keep the existing stored password' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ enum: ENCRYPTIONS })
  @IsOptional()
  @IsIn(ENCRYPTIONS)
  encryption?: SmtpEncryption;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  senderName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  senderEmail?: string;
}
