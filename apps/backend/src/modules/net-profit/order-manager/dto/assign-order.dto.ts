import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional } from 'class-validator';

export class AssignOrderDto {
  // null unassigns, same convention as BulkOrderActionDto.assignedAdminId.
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  assignedAdminId?: number | null;
}
