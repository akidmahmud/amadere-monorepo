import { ApiProperty } from '@nestjs/swagger';

export class FeedIssueDto {
  @ApiProperty() reason!: string;
  @ApiProperty() count!: number;
  @ApiProperty({ type: [Number], required: false }) productIds?: number[];
}

export class CatalogFeedStatusDto {
  @ApiProperty() productCount!: number;
  @ApiProperty() generatedAt!: string;
  /** CSV — what goes in Commerce Manager's scheduled-feed URL box. */
  @ApiProperty() metaUrl!: string;
  /** JSON — for the Catalog Batch API, not the URL box. */
  @ApiProperty() metaJsonUrl!: string;
  @ApiProperty() googleUrl!: string;
  @ApiProperty() tiktokUrl!: string;
  /** Products left out entirely, and why. */
  @ApiProperty({ type: [FeedIssueDto] }) skipped!: FeedIssueDto[];
  /** Rows that ship but a platform will reject — fix the product data. */
  @ApiProperty({ type: [FeedIssueDto] }) warnings!: FeedIssueDto[];
}
