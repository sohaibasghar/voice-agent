import { Module } from '@nestjs/common';
import { OpenAIService } from './openai.service';
import { SessionController } from './session.controller';

@Module({
  controllers: [SessionController],
  providers: [OpenAIService],
  exports: [OpenAIService],
})
export class SessionModule {}
