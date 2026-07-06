import { Controller, Get, Query } from '@nestjs/common';
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
