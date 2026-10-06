import { Module } from '@nestjs/common';
import { ScheduleModule } from '../schedule/schedule.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [ScheduleModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
