import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { MenusService } from './menus.service';
import { PublicMenuItemDto } from './menus.mapper';

@ApiTags('menu')
@Controller('menu')
export class MenuController {
  constructor(private readonly menus: MenusService) {}

  @Get()
  @ApiOkResponse({ type: PublicMenuItemDto, isArray: true })
  getTree(@Query() { locale }: LocaleQueryDto): Promise<PublicMenuItemDto[]> {
    return this.menus.publicTree(locale ?? 'EN');
  }
}
