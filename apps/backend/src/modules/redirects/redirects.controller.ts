import { Controller, Get, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { RedirectsService } from './redirects.service';

@ApiTags('redirects')
@Controller('redirects')
export class RedirectsController {
  constructor(private readonly redirects: RedirectsService) {}

  @Get('resolve')
  @ApiQuery({ name: 'path', description: 'e.g. /old-product-slug' })
  resolve(@Query('path') path: string) {
    return this.redirects.resolve(path);
  }
}
