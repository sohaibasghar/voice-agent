import { Body, Controller, Post } from '@nestjs/common';
import { OpenAIService } from './openai.service';
import type { SessionTokenOutput } from 'voice-agent-shared';

/** POST /session — mints an ephemeral realtime token for the browser. */
@Controller('session')
export class SessionController {
  constructor(private readonly openai: OpenAIService) {}

  @Post()
  async createSession(
    @Body() body: { modelTier?: 'dev' | 'live' },
  ): Promise<SessionTokenOutput> {
    return this.openai.mintEphemeralToken(body?.modelTier);
  }
}
