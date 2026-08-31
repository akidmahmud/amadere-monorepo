import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

/**
 * The note on a deleted cart, edited in place from the trash tab's cell.
 *
 * Deliberately allows an empty string, unlike the old cancel flow which
 * demanded a reason: clearing a note someone typed by mistake is a normal
 * thing to want, and the service stores blank as null so "no reason" stays
 * one state rather than two.
 */
export class UpdateCartReasonDto {
  @ApiProperty({ description: 'Blank clears the reason' })
  @IsString()
  @MaxLength(500)
  reason!: string;
}
