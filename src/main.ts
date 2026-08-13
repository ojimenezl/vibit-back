import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get(ConfigService);

  app.use(json({ limit: '4mb' }));
  app.use(urlencoded({ extended: true, limit: '4mb' }));

  app.setGlobalPrefix('api');

  const corsRaw = config.get<string>('CORS_ORIGIN', '*');
  const origin =
    corsRaw.trim() === '*'
      ? true
      : corsRaw.split(',').map((item) => item.trim()).filter(Boolean);

  app.enableCors({
    origin,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(config.get<string>('PORT')) || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Vibit API on http://0.0.0.0:${port}/api`);
}

bootstrap();
