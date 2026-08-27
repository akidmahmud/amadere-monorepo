import { ApiProperty } from '@nestjs/swagger';

export class FeedIssueDto {
  @ApiProperty() reason!: string;
  @ApiProperty() count!: number;
  @ApiProperty({ type: [Number], required: false }) productIds?: number[];
}

export class CatalogFeedStatusDto {
  @ApiProperty() productCount!: number;
  @ApiProperty() generatedAt!: string;
  @ApiProperty() metaUrl!: string;
  @ApiProperty() googleUrl!: string;
  @ApiProperty() tiktokUrl!: string;
  /** Products left out entirely, and why. */
  @ApiProperty({ type: [FeedIssueDto] }) skipped!: FeedIssueDto[];
  /** Rows that ship but a platform will reject — fix the product data. */
  @ApiProperty({ type: [FeedIssueDto] }) warnings!: FeedIssueDto[];
}
