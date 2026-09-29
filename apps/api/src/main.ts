import 'reflect-metadata';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { isSwaggerEnabled, type LogLevel } from '@ravion/validation';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { redactSensitiveText } from './common/logger/redact';
import { requestLogger } from './common/middleware/request-logger.middleware';
import { loadEnvFiles } from './config/load-env';
import { applyOpenApiConventions, buildSwaggerConfig, swaggerModels } from './config/swagger';

const LOG_LEVELS: LogLevel[] = ['error', 'warn', 'log', 'debug', 'verbose'];

function readSwaggerFlag(config: ConfigService): 'true' | 'false' | undefined {
  const value = config.get<string>('SWAGGER_ENABLED');
  if (value === 'true' || value === 'false') {
    return value;
  }
  return undefined;
}

async function bootstrap(): Promise<void> {
  loadEnvFiles();

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('PORT');
  const nodeEnv = config.getOrThrow<string>('NODE_ENV');
  const logLevel = config.getOrThrow<LogLevel>('LOG_LEVEL');
  const levelIndex = LOG_LEVELS.indexOf(logLevel);
  app.useLogger(LOG_LEVELS.slice(0, levelIndex + 1));

  const swaggerEnabled = isSwaggerEnabled({
    NODE_ENV: nodeEnv === 'production' || nodeEnv === 'test' ? nodeEnv : 'development',
    SWAGGER_ENABLED: readSwaggerFlag(config),
  });

  app.use(
    helmet({
      contentSecurityPolicy: swaggerEnabled ? false : undefined,
    }),
  );
  app.enableCors({
    origin: config
      .getOrThrow<string>('CORS_ORIGINS')
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });
  app.use(requestLogger());
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter(nodeEnv === 'production'));
  app.enableShutdownHooks();

  if (swaggerEnabled) {
    const document = SwaggerModule.createDocument(app, buildSwaggerConfig(port), {
      extraModels: swaggerModels,
      operationIdFactory: (_controllerKey: string, methodKey: string) => methodKey,
    });

    SwaggerModule.setup('docs', app, applyOpenApiConventions(document), {
      useGlobalPrefix: true,
      jsonDocumentUrl: 'docs-json',
      yamlDocumentUrl: 'docs-yaml',
    });
  }

  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`Ravion Barber API listening on port ${port}`);
  if (swaggerEnabled) {
    logger.log('Swagger UI available at /api/docs');
  }
}

void bootstrap().catch((error: unknown) => {
  const message =
    error instanceof Error ? redactSensitiveText(error.message) : 'Unknown startup error';
  console.error(`Failed to start Ravion Barber API: ${message}`);
  process.exit(1);
});
