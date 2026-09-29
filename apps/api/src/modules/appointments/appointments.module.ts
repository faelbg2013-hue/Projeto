import { Module } from '@nestjs/common';
import { PointsModule } from '../points/points.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { AppointmentsController, ProfessionalAppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { ProfessionalDayController } from './professional-day.controller';
import { ProfessionalDayService } from './professional-day.service';

@Module({
  imports: [ScheduleModule, PointsModule],
  controllers: [AppointmentsController, ProfessionalAppointmentsController, ProfessionalDayController],
  providers: [AppointmentsService, ProfessionalDayService],
})
export class AppointmentsModule {}
