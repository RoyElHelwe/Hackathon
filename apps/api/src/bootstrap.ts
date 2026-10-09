import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { config } from './config';

export function configureApp(app: INestApplication) {
  app.use(cookieParser());
  // roster CSV imports post the file text as JSON
  (app as NestExpressApplication).useBodyParser('json', { limit: '2mb' });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({ origin: config.WEB_URL, credentials: true });
  app.enableShutdownHooks();
}
