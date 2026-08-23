import { ApiProperty } from '@nestjs/swagger';

// Preview pages are the free sample — their imageUrl is a public R2 object,
// safe to hand to any admin.
export class AdminDigitalPreviewPageDto {
  @ApiProperty()
  pageNumber!: number;

  @ApiProperty()
  imageUrl!: string;
}

// Deliberately excludes digitalFileKey — it's the private storage key for a
// PDF on a public bucket, so leaking it hands out a permanent unauthenticated
// download link. The three endpoints that return this shape (upload/remove
// file, set preview pages) used to return the raw Prisma Product row, which
// included that key; this DTO is the fix. See DigitalProductsService's own
// comment on MediaStorage for the same rule applied to the write side.
export class AdminDigitalFileDto {
  @ApiProperty()
  id!: number;

  @ApiProperty({ nullable: true })
  digitalFileName!: string | null;

  @ApiProperty({ nullable: true })
  digitalFileSize!: number | null;

  @ApiProperty({ nullable: true })
  digitalPageCount!: number | null;

  /** The inclusive page range shown as the free preview, e.g. 5..9. Both null
   * until a file is uploaded. previewPages carries the rendered images for
   * exactly these pages. */
  @ApiProperty({ nullable: true })
  digitalPreviewStartPage!: number | null;

  @ApiProperty({ nullable: true })
  digitalPreviewEndPage!: number | null;

  @ApiProperty({ type: [AdminDigitalPreviewPageDto] })
  previewPages!: AdminDigitalPreviewPageDto[];
}
