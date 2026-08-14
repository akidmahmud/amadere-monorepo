import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Behind nginx (VPS deployment) req.ip otherwise resolves to the proxy's
  // own address for every request, collapsing all visitors — and the web
  // app's own server-side fetches — into one shared bucket for the global
  // ThrottlerGuard (120 req/min), exhausted almost immediately by normal
  // traffic. Trusting exactly one hop reads the real client IP from
  // X-Forwarded-For instead.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Storefront search is client-driven (fetches this API directly from the
  // browser, unlike everything else which is server-rendered or proxied) —
  // without CORS the browser silently drops the response and search looks
  // broken with no server-side error at all.
  const corsOrigins = (config.get<string>('CORS_ORIGINS') ?? 'http://localhost:3001,http://localhost:3002').split(',');
  app.enableCors({ origin: corsOrigins, credentials: true });

  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'sitemap.xml', 'robots.txt', ':key.txt'],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Amader API')
    .setDescription('Amader eCommerce backend API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(config.get<number>('PORT') ?? 3000);
}
void bootstrap();
