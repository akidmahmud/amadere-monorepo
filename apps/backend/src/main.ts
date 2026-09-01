import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Nest's default body parser caps JSON bodies at Express's own default of
  // 100kb, silently 413'ing (surfaced to the client as a generic 500 before
  // HttpExceptionFilter's frameworkStatus handling was added — see that
  // file's comment) any request past that. Admin-authored rich content
  // (product "Full Description", blog post bodies, etc. — especially
  // anything pasted in from Word/Google Docs, whose export HTML wraps nearly
  // every word in its own styled <span>) routinely exceeds 100kb well before
  // hitting any of this app's own actual validation limits.
  app.useBodyParser('json', { limit: '5mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '5mb' });
  const config = app.get(ConfigService);

  // Behind nginx (VPS deployment) req.ip otherwise resolves to the proxy's
  // own address for every request, collapsing all visitors — and the web
  // app's own server-side fetches — into one shared bucket for the global
  // ThrottlerGuard (120 req/min), exhausted almost immediately by normal
  // traffic. Trusting exactly one hop reads the real client IP from
  // X-Forwarded-For instead.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Express advertises `x-powered-by: Express` by default. No reason to hand
  // the stack to anyone probing — disable it.
  app.getHttpAdapter().getInstance().disable('x-powered-by');

  // Storefront search is client-driven (fetches this API directly from the
  // browser, unlike everything else which is server-rendered or proxied) —
  // without CORS the browser silently drops the response and search looks
  // broken with no server-side error at all.
  const corsOrigins = (config.get<string>('CORS_ORIGINS') ?? 'http://localhost:3001,http://localhost:3002').split(',');
  app.enableCors({ origin: corsOrigins, credentials: true });

  // This API answers on its own hostname (api.amadere.com), which — unlike
  // the storefront — is not proxied through Cloudflare, so nothing upstream
  // adds security headers on its behalf. Measured before this: the storefront
  // returned HSTS, nosniff, X-Frame-Options and Referrer-Policy; the API
  // returned none of them.
  //
  // ponytail: four headers inline rather than adding helmet. Helmet's other
  // dozen defaults (CSP, DNS-prefetch control, cross-origin isolation) are
  // aimed at HTML documents, which this API never returns. Add helmet if it
  // ever serves a page.
  app.getHttpAdapter().getInstance().use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'sitemap.xml', 'robots.txt', ':key.txt'],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  // The OpenAPI document is a complete map of this API — every endpoint,
  // parameter and DTO, the whole admin surface included. It was mounted
  // unconditionally and was live in production at
  // https://api.amadere.com/api/docs (plus -json and -yaml).
  //
  // It looked safe because `setGlobalPrefix('api/v1')` does NOT apply to
  // SwaggerModule.setup's own path — probing /api/v1/docs returns 404 while
  // /api/docs served the full spec. Every endpoint it lists is auth-guarded,
  // so this was reconnaissance rather than access, but there is no reason to
  // publish the map.
  //
  // Opt-in rather than a hard block, because AGENTS.web.md §"live Swagger"
  // cites this as a reference source: set SWAGGER_ENABLED=true to bring it
  // back temporarily, and unset it when finished. Outside production it is
  // always on, so local development is unaffected.
  const swaggerEnabled =
    config.get<string>('NODE_ENV') !== 'production' ||
    config.get<string>('SWAGGER_ENABLED') === 'true';

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Amader API')
      .setDescription('Amader eCommerce backend API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(config.get<number>('PORT') ?? 3000);
}
void bootstrap();
