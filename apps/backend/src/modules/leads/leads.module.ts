import { Module } from '@nestjs/common';
import { AdminLeadsController } from './admin-leads.controller';
import { LeadsService } from './leads.service';
import { LeadDashboardService } from './lead-dashboard.service';

// Lead Center (admin only): leads that haven't ordered yet, their calls, the
// call-desk dashboard, and the lead → customer conversion on a first order.
@Module({
  controllers: [AdminLeadsController],
  providers: [LeadsService, LeadDashboardService],
})
export class LeadsModule {}
