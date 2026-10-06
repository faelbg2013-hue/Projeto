import { Module } from '@nestjs/common';
import { ScheduleNow } from '../../common/time/schedule-now';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';

@Module({
  controllers: [ScheduleController],
  providers: [ScheduleService, ScheduleNow],
  exports: [ScheduleService, ScheduleNow],
})
export class ScheduleModule {}
