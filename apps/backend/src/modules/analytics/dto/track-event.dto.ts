import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class TrackEventDto {
  @ApiProperty({ description: 'e.g. "page_view", "view_item", "add_to_cart"' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Frontend-generated anonymous id' })
  @IsOptional()
  @IsString()
  clientId?: string;
}
