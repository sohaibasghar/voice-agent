import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { VoiceGateway } from './voice.gateway';
import { VoiceAgentsService } from './voice-agents.service';
import { TraceService } from './trace.service';
import { ToolsModule } from '../tools/tools.module';

@Module({
  imports: [ToolsModule],
  providers: [RealtimeGateway, VoiceGateway, VoiceAgentsService, TraceService],
  exports: [TraceService],
})
export class RealtimeModule {}
