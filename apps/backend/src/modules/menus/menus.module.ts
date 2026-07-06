import { Module } from '@nestjs/common';
import { AdminMenuItemsController } from './admin-menu-items.controller';
import { MenuController } from './menu.controller';
import { MenusService } from './menus.service';

@Module({
  controllers: [AdminMenuItemsController, MenuController],
  providers: [MenusService],
})
export class MenusModule {}
