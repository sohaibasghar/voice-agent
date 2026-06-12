import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Browser frontend (Next.js) calls /session and /tools/* cross-origin.
  app.enableCors({ origin: true });
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
