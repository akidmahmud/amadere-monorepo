import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CampaignChannel, CampaignStatus, DelayUnit } from '@amader/db';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpsertCampaignTemplateDto {
  @ApiProperty({ enum: CampaignChannel })
  @IsEnum(CampaignChannel)
  channel!: CampaignChannel;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: 'Email only' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty()
  @IsString()
  bodyEn!: string;

  @ApiProperty()
  @IsString()
  bodyBn!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  delayValue!: number;

  @ApiProperty({ enum: DelayUnit })
  @IsEnum(DelayUnit)
  delayUnit!: DelayUnit;

  @ApiPropertyOptional({ enum: CampaignStatus })
  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;
}
