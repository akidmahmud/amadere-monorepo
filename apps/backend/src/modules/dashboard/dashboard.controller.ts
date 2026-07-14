import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { DashboardService } from './dashboard.service';
import { DashboardOverviewDto } from './dashboard.dto';

@ApiTags('admin/dashboard')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('overview')
  @RequirePermission('dashboard.view')
  @ApiOkResponse({ type: DashboardOverviewDto })
  overview(): Promise<DashboardOverviewDto> {
    return this.dashboard.overview();
  }
}
