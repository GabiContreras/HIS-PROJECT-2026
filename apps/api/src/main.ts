import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common/pipes/index.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const origins = (process.env.FRONTEND_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim());
  app.enableCors({ origin: origins, credentials: true });
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
