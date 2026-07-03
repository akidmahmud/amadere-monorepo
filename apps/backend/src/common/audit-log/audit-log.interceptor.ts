import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditLogService } from './audit-log.service';
import { RequestWithAdmin } from '../auth/admin-jwt.guard';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Add @UseInterceptors(AuditLogInterceptor) to each admin-<feature>.controller.ts
// that performs writes — logs who/what/when with zero per-endpoint code.
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly auditLog: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithAdmin>();
    if (!MUTATING_METHODS.has(request.method)) {
      return next.handle();
    }

    const controllerName = context.getClass().name.replace(/Controller$/, '');

    return next.handle().pipe(
      tap((result) => {
        const entityId = (result as { id?: number } | undefined)?.id;
        void this.auditLog.record({
          adminUserId: request.adminUser?.id ?? null,
          action: `${request.method} ${request.path}`,
          entityType: controllerName,
          entityId,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        });
      }),
    );
  }
}
