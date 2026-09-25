import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class UpsertStoreDto {
  @ApiProperty() @IsString() @Length(1, 100) name!: string;
  @ApiProperty({ example: 'DHK1' })
  @Matches(/^[A-Z0-9]{2,10}$/, { message: 'Code: 2-10 capital letters/digits' })
  code!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  cashAccountId?: number | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  cardAccountId?: number | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  mobileAccountId?: number | null;
}

export class AssignStaffDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  adminUserIds!: number[];
}

/** `?storeId=` on any store-scoped read; ignored unless the caller has pos.all_stores. */
export class StoreQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  storeId?: number;
}
