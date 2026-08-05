import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('Auth + RBAC (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
  });

  it('registers a customer, verifies the registration OTP, logs in, and reads its own profile', async () => {
    const phone = `01${String(Date.now()).slice(-9)}`;
    const email = `e2e-${Date.now()}@test.com`;

    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        firstName: 'E2E',
        lastName: 'Test',
        phone,
        email,
        password: 'TestPass123',
      })
      .expect(201);
    expect((register.body as { data: { pending: true } }).data.pending).toBe(
      true,
    );

    // register() doesn't sign anyone in — read the code the way the real
    // SMS would have delivered it, straight from the row OtpService wrote.
    const prisma = app.get(PrismaService);
    const otp = await prisma.client.otp.findFirst({
      where: { identifier: phone, purpose: 'REGISTER', consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    expect(otp).toBeTruthy();

    const verify = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/verify')
      .send({ identifier: phone, code: otp!.code, purpose: 'REGISTER' })
      .expect(201);
    const accessToken = (verify.body as { data: { accessToken: string } }).data
      .accessToken;
    expect(accessToken).toBeTruthy();

    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect((me.body as { data: { phone: string } }).data.phone).toBe(phone);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone, password: 'TestPass123' })
      .expect(201);
    expect(
      (login.body as { data: { accessToken: string } }).data.accessToken,
    ).toBeTruthy();
  });

  it('rejects admin RBAC access without a token, and allows it with the super admin', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/rbac/roles')
      .expect(401);

    const email = process.env.SUPER_ADMIN_EMAIL;
    const password = process.env.SUPER_ADMIN_PASSWORD;
    if (!email || !password)
      throw new Error(
        'SUPER_ADMIN_EMAIL/PASSWORD must be set to run this test',
      );

    const login = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ email, password })
      .expect(201);
    const accessToken = (login.body as { data: { accessToken: string } }).data
      .accessToken;

    const roles = await request(app.getHttpServer())
      .get('/api/v1/admin/rbac/roles')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const roleNames = (roles.body as { data: { name: string }[] }).data.map(
      (r) => r.name,
    );
    expect(roleNames).toContain('Super Admin');
  });

  afterEach(async () => {
    await app.close();
  });
});
