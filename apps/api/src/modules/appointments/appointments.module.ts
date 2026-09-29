import { Module } from '@nestjs/common';
import { PointsModule } from '../points/points.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { AppointmentsController, ProfessionalAppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

@Module({
  imports: [ScheduleModule, PointsModule],
  controllers: [AppointmentsController, ProfessionalAppointmentsController],
  providers: [AppointmentsService],
})
export class AppointmentsModule {}
