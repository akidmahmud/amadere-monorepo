import { Body, Controller, Get, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { FooterService } from './footer.service';
import { FooterConfig } from './footer.types';
import { UpdateFooterDto } from './dto/update-footer.dto';

@ApiTags('admin/footer')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/footer')
export class AdminFooterController {
  constructor(private readonly footer: FooterService) {}

  // Typed as UpdateFooterDto rather than the FooterConfig interface: read and
  // write carry the identical shape, and declaring the class here is what
  // puts it in the OpenAPI document for the admin app's typegen to pick up.
  @Get()
  @RequirePermission('footer.view')
  @ApiOkResponse({ type: UpdateFooterDto })
  get(): Promise<FooterConfig> {
    return this.footer.getAdmin();
  }

  // PUT, not PATCH: the admin form always submits the whole document, and a
  // partial merge of a nested array is exactly the ambiguity we avoided by
  // storing this as one blob.
  @Put()
  @RequirePermission('footer.update')
  @ApiOkResponse({ type: UpdateFooterDto })
  update(@Body() dto: UpdateFooterDto): Promise<FooterConfig> {
    return this.footer.update(dto as unknown as FooterConfig);
  }
}
