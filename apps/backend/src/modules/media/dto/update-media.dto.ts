import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateMediaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  altText?: string;

  // No @Type(() => Number) — this is a JSON body field (already a real
  // number/null from the parser), unlike MediaQueryDto's folderId which
  // comes in as a query-string value needing coercion. Same pattern as
  // UpdateCustomerDto.assignedAdminId.
  @ApiPropertyOptional({ description: 'Move into this folder, or null to un-file it' })
  @IsOptional()
  @IsInt()
  folderId?: number | null;
}
