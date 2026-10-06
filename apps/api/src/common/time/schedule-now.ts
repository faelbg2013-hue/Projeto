import { Injectable } from '@nestjs/common';

/** Relógio da agenda. Os testes substituem o provider para não depender da hora da máquina. */
@Injectable()
export class ScheduleNow {
  now(): Date {
    return new Date();
  }
}
