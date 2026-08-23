import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';
import { DIGITAL_PREVIEW_PAGES_MAX } from '@amader/shared';

// The preview is an inclusive page RANGE, not a count from the front of the
// document. Only the bounds that depend on nothing else are checked here —
// `endPage >= startPage`, `endPage <= digitalPageCount` and the
// DIGITAL_PREVIEW_PAGES_MAX range length all need either the other field or
// the stored document, so DigitalProductsService.setPreviewRange owns them
// and returns a message naming the actual document.
export class SetPreviewRangeDto {
  @ApiProperty({ minimum: 1, description: 'First page of the free preview (1-based, inclusive).' })
  @IsInt()
  @Min(1)
  startPage!: number;

  @ApiProperty({
    minimum: 1,
    description: `Last page of the free preview (inclusive). Must be >= startPage, within the document's page count, and cover at most ${DIGITAL_PREVIEW_PAGES_MAX} pages.`,
  })
  @IsInt()
  @Min(1)
  endPage!: number;
}
