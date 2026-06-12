import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { TraceService } from './trace.service';

@Module({
  providers: [RealtimeGateway, TraceService],
  exports: [TraceService],
})
export class RealtimeModule {}
