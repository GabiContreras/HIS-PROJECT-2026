import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common/pipes/index.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    app.enableCors({ origin: 'http://localhost:5173' }); // puerto default de Vite
    await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
