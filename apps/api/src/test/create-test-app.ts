import { ValidationPipe, VersioningType, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { AppModule } from '../app.module';
import { GlobalExceptionFilter } from '../common/filters/global-exception.filter';
import { ScheduleNow } from '../common/time/schedule-now';

export async function createTestApp(options?: { now?: () => Date }): Promise<INestApplication> {
  const builder = Test.createTestingModule({
    imports: [AppModule],
  });
  if (options?.now) {
    const now = options.now;
    builder.overrideProvider(ScheduleNow).useValue({ now: () => now() });
  }
  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter(true));
  await app.init();
  return app;
}
