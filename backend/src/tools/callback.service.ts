import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { LogCallbackInput, LogCallbackOutput } from 'voice-agent-shared';

/** logCallback (FR-013a) — escalation: record a human-follow-up request. */
@Injectable()
export class CallbackService {
  private readonly logger = new Logger(CallbackService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logCallback(input: LogCallbackInput): Promise<LogCallbackOutput> {
    const created = await this.prisma.callbackRequest.create({
      data: {
        customerName: input.customerName,
        contact: input.contact,
        reason: input.reason,
      },
    });
    this.logger.log(`Callback logged: ${created.id} for ${input.customerName}`);
    return { callbackId: created.id };
  }
}
