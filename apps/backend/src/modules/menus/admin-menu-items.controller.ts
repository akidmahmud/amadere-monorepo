import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { MenusService } from './menus.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { AdminMenuItemDto } from './menus.mapper';

@ApiTags('admin/menu-items')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/menu-items')
export class AdminMenuItemsController {
  constructor(private readonly menus: MenusService) {}

  @Get()
  @RequirePermission('menu_item.view')
  @ApiOkResponse({ type: AdminMenuItemDto, isArray: true })
  list(): Promise<AdminMenuItemDto[]> {
    return this.menus.adminList();
  }

  @Get(':id')
  @RequirePermission('menu_item.view')
  @ApiOkResponse({ type: AdminMenuItemDto })
  get(@Param('id', ParseIntPipe) id: number): Promise<AdminMenuItemDto> {
    return this.menus.adminGet(id);
  }

  @Post()
  @RequirePermission('menu_item.create')
  @ApiOkResponse({ type: AdminMenuItemDto })
  create(@Body() dto: CreateMenuItemDto): Promise<AdminMenuItemDto> {
    return this.menus.create(dto);
  }

  @Patch(':id')
  @RequirePermission('menu_item.update')
  @ApiOkResponse({ type: AdminMenuItemDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMenuItemDto,
  ): Promise<AdminMenuItemDto> {
    return this.menus.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('menu_item.delete')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.menus.delete(id);
  }
}
