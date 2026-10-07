import { Module } from '@nestjs/common';
import { PointsModule } from '../points/points.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [PointsModule, ScheduleModule],
  controllers: [ClientsController],
  providers: [ClientsService],
})
export class ClientsModule {}
