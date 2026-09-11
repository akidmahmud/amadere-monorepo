import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { TrafficService, type TrafficStats } from './traffic.service';

@ApiTags('admin/traffic')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@Controller('admin/traffic')
export class AdminTrafficController {
  constructor(private readonly traffic: TrafficService) {}

  // Gated on dashboard.view rather than a permission of its own: this is one
  // panel on the Overview, and anyone allowed to see that page's revenue is
  // already seeing more sensitive numbers than a visitor count.
  @Get('stats')
  @RequirePermission('dashboard.view')
  stats(): Promise<TrafficStats> {
    return this.traffic.stats();
  }
}
