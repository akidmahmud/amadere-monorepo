import { Controller, Get, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { RedirectsService } from './redirects.service';
import {
  RedirectFoundDto,
  RedirectNotFoundDto,
  RedirectResolveResult,
} from './redirects.mapper';

// Public, read-only, called on every unmatched storefront path (every real
// 404, and previously every falsely-throttled one too) — see
// SiteInfoController's comment for why this is exempt from the global
// per-IP throttle.
@SkipThrottle()
@ApiTags('redirects')
@Controller('redirects')
export class RedirectsController {
  constructor(private readonly redirects: RedirectsService) {}

  @Get('resolve')
  @ApiQuery({ name: 'path', description: 'e.g. /old-product-slug' })
  @ApiExtraModels(RedirectFoundDto, RedirectNotFoundDto)
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(RedirectFoundDto) },
        { $ref: getSchemaPath(RedirectNotFoundDto) },
      ],
    },
  })
  resolve(@Query('path') path: string): Promise<RedirectResolveResult> {
    return this.redirects.resolve(path);
  }
}
