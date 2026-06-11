import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // The authenticated front ends live on sibling subdomains and call this API
  // cross-origin. Allow the local surfaces and the dev tenant header. On the
  // server these same keys carry the production origins.
  app.enableCors({
    origin: [
      config.get<string>('TEAMS_BASE_URL', 'https://teams.netballamericas.test'),
      config.get<string>('PLATFORM_BASE_URL', 'https://platform.netballamericas.test'),
      config.get<string>('PUBLIC_BASE_URL', 'https://www.netballamericas.test'),
    ],
    allowedHeaders: ['content-type', 'x-delegation-id'],
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
