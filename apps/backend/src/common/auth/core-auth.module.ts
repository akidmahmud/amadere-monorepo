import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TokenService } from './token.service';
import { AdminJwtGuard } from './admin-jwt.guard';
import { CustomerJwtGuard } from './customer-jwt.guard';
import { PermissionGuard } from './permission.guard';

// Cross-cutting auth primitives (JWT signing/verification, guards, RBAC
// permission check) shared by every feature module — analogous to PrismaModule.
@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [TokenService, AdminJwtGuard, CustomerJwtGuard, PermissionGuard],
  exports: [TokenService, AdminJwtGuard, CustomerJwtGuard, PermissionGuard],
})
export class CoreAuthModule {}
