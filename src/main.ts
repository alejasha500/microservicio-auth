import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Detrás de un balanceador (AWS), para que el rate limit vea la IP real
  app.set('trust proxy', 1);

  // Cabeceras de seguridad
  app.use(helmet());

  // CORS: solo los orígenes que tú indiques
  const origins = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origins.length ? origins : false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true,  forbidNonWhitelisted: true }));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();