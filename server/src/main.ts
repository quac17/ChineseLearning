import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';
import * as dotenv from 'dotenv';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { assertProductionEnv } from './config/production-env';

async function bootstrap() {
  // Fail before Nest starts: a revision with dev defaults must never serve traffic.
  // Same .env files as ConfigModule; real environment variables win.
  dotenv.config({ path: '.env' });
  dotenv.config({ path: '../.env' });
  assertProductionEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Behind Cloud Run / a load balancer, req.ip must come from X-Forwarded-For
  // (password reset limits per IP). TRUST_PROXY = number of proxy hops; unset
  // locally so a client cannot fake its address.
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy) app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);

  app.use(cookieParser());
  app.setGlobalPrefix('api');

  const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins.length === 1 && corsOrigins[0] === '*' ? true : corsOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const port = Number(process.env.PORT) || 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`Van Kinh NestJS Server listening on http://0.0.0.0:${port}/api`);
}

bootstrap();
