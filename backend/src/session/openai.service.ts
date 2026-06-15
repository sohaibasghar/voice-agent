import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SessionTokenOutput } from 'voice-agent-shared';

const CLIENT_SECRETS_URL = 'https://api.openai.com/v1/realtime/client_secrets';

// research.md D10 — confirm exact ids at platform.openai.com before a live run.
const MODEL_BY_TIER: Record<string, string> = {
  dev: 'gpt-realtime-mini',
  live: 'gpt-realtime-2',
};

/**
 * Mints short-lived ephemeral realtime tokens. The real OPENAI_API_KEY lives
 * only here and never reaches the browser (Constitution I, FR-016).
 */
@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);

  constructor(private readonly config: ConfigService) {}

  resolveModel(tier?: string): string {
    const t = tier ?? this.config.get<string>('MODEL_TIER', 'dev');
    return MODEL_BY_TIER[t] ?? MODEL_BY_TIER.dev;
  }

  async mintEphemeralToken(tier?: string): Promise<SessionTokenOutput> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey || apiKey.startsWith('sk-REPLACE')) {
      throw new InternalServerErrorException(
        'OPENAI_API_KEY is not configured',
      );
    }
    const model = this.resolveModel(tier);

    const res = await fetch(CLIENT_SECRETS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ session: { type: 'realtime', model } }),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`client_secrets failed: ${res.status} ${body}`);
      throw new InternalServerErrorException('Failed to mint realtime token');
    }

    const data = (await res.json()) as { value: string; expires_at?: number };
    const expiresAt = data.expires_at
      ? new Date(data.expires_at * 1000).toISOString()
      : new Date(Date.now() + 60_000).toISOString();

    return { value: data.value, model, expiresAt };
  }
}
