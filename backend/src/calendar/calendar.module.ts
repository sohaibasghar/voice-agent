import { Global, Module } from '@nestjs/common';
import { CalendarStore } from './calendar.store';

@Global()
@Module({
  providers: [CalendarStore],
  exports: [CalendarStore],
})
export class CalendarModule {}
