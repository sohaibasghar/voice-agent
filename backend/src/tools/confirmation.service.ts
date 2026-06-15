import { Injectable, Logger } from '@nestjs/common';
import type {
  SendConfirmationInput,
  SendConfirmationOutput,
} from 'voice-agent-shared';

/**
 * sendConfirmation (FR-014) — v1 mocks a WhatsApp/SMS send by logging it.
 * No real delivery (future path: real WhatsApp/SMS). Keeps a short in-memory
 * log so the demo can show "a confirmation was sent".
 */
@Injectable()
export class ConfirmationService {
  private readonly logger = new Logger(ConfirmationService.name);
  readonly sent: Array<{ contact: string; bookingId: string; ts: string }> = [];

  sendConfirmation(input: SendConfirmationInput): SendConfirmationOutput {
    const entry = {
      contact: input.contact,
      bookingId: input.bookingId,
      ts: new Date().toISOString(),
    };
    this.sent.push(entry);
    this.logger.log(
      `[MOCK WhatsApp/SMS] → ${input.contact} re booking ${input.bookingId}`,
    );
    return { ok: true, channel: 'whatsapp_sms_mock' };
  }
}
