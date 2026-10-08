import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { config } from './config';

export function configureApp(app: INestApplication) {
  app.use(cookieParser());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({ origin: config.WEB_URL, credentials: true });
  app.enableShutdownHooks();
}
