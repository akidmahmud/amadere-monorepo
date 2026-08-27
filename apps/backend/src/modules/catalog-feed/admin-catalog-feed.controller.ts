import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { CatalogFeedService } from './catalog-feed.service';
import { CatalogFeedStatusDto } from './catalog-feed.dto';

/**
 * Powers the "Catalog Data Feed" panel on Analytics. Read-only apart from a
 * manual refresh — the feed itself has no settings, it is derived entirely
 * from the products.
 */
@ApiTags('admin/catalog-feed')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@Controller('admin/catalog-feed')
export class AdminCatalogFeedController {
  constructor(private readonly feed: CatalogFeedService) {}

  @Get('status')
  @RequirePermission('analytics.view')
  @ApiOkResponse({ type: CatalogFeedStatusDto })
  async status(): Promise<CatalogFeedStatusDto> {
    const built = await this.feed.get();
    return {
      productCount: built.items.length,
      generatedAt: built.generatedAt.toISOString(),
      metaUrl: `${this.feed.shopUrl}/api/feed/meta`,
      googleUrl: `${this.feed.shopUrl}/api/feed/google`,
      tiktokUrl: `${this.feed.shopUrl}/api/feed/tiktok`,
      skipped: built.skipped,
      warnings: built.warnings,
    };
  }

  // POST, not GET: this discards the cache and re-reads every published
  // product, which is a side effect and must not be triggered by a prefetch.
  @Post('refresh')
  @RequirePermission('analytics.manage')
  @ApiOkResponse({ type: CatalogFeedStatusDto })
  async refresh(): Promise<CatalogFeedStatusDto> {
    await this.feed.rebuild();
    return this.status();
  }
}
