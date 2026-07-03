import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import * as Joi from 'joi';
import * as path from 'node:path';
import { PrismaModule } from './common/prisma/prisma.module';
import { CoreAuthModule } from './common/auth/core-auth.module';
import { AuditLogModule } from './common/audit-log/audit-log.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { AdminUsersModule } from './modules/admin-users/admin-users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(__dirname, '../../../.env'),
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        PORT: Joi.number().port().default(3000),
        DATABASE_URL: Joi.string().uri().required(),
        ADMIN_JWT_ACCESS_SECRET: Joi.string().min(16).required(),
        ADMIN_JWT_REFRESH_SECRET: Joi.string().min(16).required(),
        CUSTOMER_JWT_ACCESS_SECRET: Joi.string().min(16).required(),
        CUSTOMER_JWT_REFRESH_SECRET: Joi.string().min(16).required(),
        SUPER_ADMIN_EMAIL: Joi.string().email().required(),
        SUPER_ADMIN_PASSWORD: Joi.string().min(8).required(),
      }),
    }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    CoreAuthModule,
    AuditLogModule,
    HealthModule,
    AuthModule,
    RbacModule,
    AdminUsersModule,
  ],
})
export class AppModule {}
