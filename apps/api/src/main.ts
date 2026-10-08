import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { config } from './config';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  configureApp(app);
  await app.listen(config.PORT);
  console.log(`Tajriba API on http://localhost:${config.PORT} (AI=${config.AI_PROVIDER}, Classroom=${config.CLASSROOM_PROVIDER}, devLogin=${config.DEV_LOGIN})`);
}
main();
