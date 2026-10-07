import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from '@ravion/validation';
import { AuthGuard } from './common/auth/auth.guard';
import { RolesGuard } from './common/auth/roles.guard';
import { skipsAuthThrottle } from './common/security/auth-throttle';
import { AppThrottlerGuard } from './common/security/app-throttler.guard';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClientsModule } from './modules/clients/clients.module';
import { HealthModule } from './modules/health/health.module';
import { PointsModule } from './modules/points/points.module';
import { ProfessionalsModule } from './modules/professionals/professionals.module';
import { ScheduleModule } from './modules/schedule/schedule.module';
import { ServicesModule } from './modules/services/services.module';
import { SettingsModule } from './modules/settings/settings.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: (config: Record<string, unknown>) => validateEnv(config),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const authTtl = config.getOrThrow<number>('AUTH_THROTTLE_TTL_MS');
        return {
          throttlers: [
            {
              name: 'default',
              ttl: config.getOrThrow<number>('THROTTLE_TTL_MS'),
              limit: config.getOrThrow<number>('THROTTLE_LIMIT'),
            },
            {
              name: 'login',
              ttl: authTtl,
              limit: config.getOrThrow<number>('AUTH_LOGIN_LIMIT'),
              skipIf: skipsAuthThrottle('login'),
            },
            {
              name: 'register',
              ttl: authTtl,
              limit: config.getOrThrow<number>('AUTH_REGISTER_LIMIT'),
              skipIf: skipsAuthThrottle('register'),
            },
            {
              name: 'refresh',
              ttl: authTtl,
              limit: config.getOrThrow<number>('AUTH_REFRESH_LIMIT'),
              skipIf: skipsAuthThrottle('refresh'),
            },
          ],
        };
      },
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    ProfessionalsModule,
    ScheduleModule,
    ServicesModule,
    SettingsModule,
    AppointmentsModule,
    DashboardModule,
    PointsModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
