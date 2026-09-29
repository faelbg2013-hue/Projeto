import { Module } from '@nestjs/common';
import { ClientPointsController, PointsController } from './points.controller';
import { PointsService } from './points.service';

@Module({
  controllers: [PointsController, ClientPointsController],
  providers: [PointsService],
  exports: [PointsService],
})
export class PointsModule {}
