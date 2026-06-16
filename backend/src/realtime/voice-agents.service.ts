import { Inject, Injectable } from '@nestjs/common';
import { RealtimeAgent, tool } from '@openai/agents-realtime';
import type { RealtimeOutputGuardrail } from '@openai/agents-realtime';
import {
  BookSlotInput,
  CancelBookingInput,
  CheckAvailabilityInput,
  LogCallbackInput,
  LookupBookingInput,
  LookupFaqInput,
  LookupServicesInput,
  RescheduleBookingInput,
  SendConfirmationInput,
} from 'voice-agent-shared';
import { DOMAIN_CONFIG, type DomainConfig } from '../domain/domain.config';
import { AvailabilityService } from '../tools/availability.service';
import { BookingService } from '../tools/booking.service';
import { CallbackService } from '../tools/callback.service';
import { ConfirmationService } from '../tools/confirmation.service';
import { FaqService } from '../tools/faq.service';
import { ToolError } from '../common/tool-error';

/** Wrap a provider result/error into the string the SDK tool contract expects. */
async function asToolResult(
  fn: () => unknown | Promise<unknown>,
): Promise<string> {
  try {
    return JSON.stringify(await fn());
  } catch (err) {
    if (err instanceof ToolError) {
      return JSON.stringify({ error: err.code, message: err.message });
    }
    throw err;
  }
}

/**
 * Builds server-side RealtimeAgents from the active DomainConfig (research.md D3).
 * Tools execute natively via injected providers — no HTTP proxy. Destructive tools
 * use `needsApproval` for human-in-the-loop. Swap domain by changing DOMAIN_PRESET.
 */
@Injectable()
export class VoiceAgentsService {
  constructor(
    @Inject(DOMAIN_CONFIG) private readonly domain: DomainConfig,
    private readonly availability: AvailabilityService,
    private readonly booking: BookingService,
    private readonly faq: FaqService,
    private readonly confirmation: ConfirmationService,
    private readonly callback: CallbackService,
  ) {}

  /** Stay-in-domain output guardrail (Constitution III, FR-013). */
  get stayInDomainGuardrail(): RealtimeOutputGuardrail {
    const { offTopicKeywords, policyHint } = this.domain.guardrail;
    return {
      name: 'stay_in_domain',
      policyHint,
      execute: ({ agentOutput }) => {
        const text =
          typeof agentOutput === 'string' ? agentOutput.toLowerCase() : '';
        return Promise.resolve({
          tripwireTriggered: offTopicKeywords.some((w) => text.includes(w)),
          outputInfo: {},
        });
      },
    };
  }

  /** Create a fresh triage agent (with its specialist handoffs) per session. */
  buildTriageAgent(): RealtimeAgent {
    const { voice, agents } = this.domain;

    const checkAvailabilityTool = tool({
      name: 'checkAvailability',
      description:
        'Find open appointment slots for a service on a date (YYYY-MM-DD), optionally narrowed to morning/afternoon/evening. Returns real open slots only.',
      parameters: CheckAvailabilityInput,
      execute: (input) =>
        asToolResult(() => this.availability.checkAvailability(input)),
    });

    const bookSlotTool = tool({
      name: 'bookSlot',
      description:
        'Book a confirmed appointment after reading details back and the caller agrees. Provide service, ISO startTime, customer name, phone contact. Rejects double-booking (slot_taken) — then offer other slots.',
      parameters: BookSlotInput,
      execute: (input) => asToolResult(() => this.booking.bookSlot(input)),
    });

    const sendConfirmationTool = tool({
      name: 'sendConfirmation',
      description:
        'Send a (mocked) WhatsApp/SMS confirmation for a booking to the phone number.',
      parameters: SendConfirmationInput,
      execute: (input) =>
        asToolResult(() => this.confirmation.sendConfirmation(input)),
    });

    const lookupBookingTool = tool({
      name: 'lookupBooking',
      description:
        'Find a caller existing booking by name + phone. If more than one matches, ask a clarifying question before acting.',
      parameters: LookupBookingInput,
      execute: (input) => asToolResult(() => this.booking.lookupBooking(input)),
    });

    // Destructive → human-in-the-loop approval. confirmed: true is passed once
    // the SDK runs execute (only after session.approve()).
    const rescheduleBookingTool = tool({
      name: 'rescheduleBooking',
      description:
        'Move a booking to a new ISO start time. Requires human approval; the new slot must be free.',
      parameters: RescheduleBookingInput.omit({ confirmed: true }),
      needsApproval: true,
      execute: (input) =>
        asToolResult(() =>
          this.booking.rescheduleBooking({ ...input, confirmed: true }),
        ),
    });

    const cancelBookingTool = tool({
      name: 'cancelBooking',
      description:
        'Cancel a booking. Requires human approval before it takes effect.',
      parameters: CancelBookingInput.omit({ confirmed: true }),
      needsApproval: true,
      execute: (input) =>
        asToolResult(() =>
          this.booking.cancelBooking({ ...input, confirmed: true }),
        ),
    });

    const lookupFaqTool = tool({
      name: 'lookupFAQ',
      description:
        'Look up a grounded answer about hours, location, parking, payment, or cancellation policy. If null, say you do not have that info — never guess.',
      parameters: LookupFaqInput,
      execute: (input) => asToolResult(() => this.faq.lookupFAQ(input)),
    });

    const lookupServicesTool = tool({
      name: 'lookupServices',
      description:
        'Look up service, pricing, and package info. Only state values returned here — never invent prices. Prices are in cents.',
      parameters: LookupServicesInput,
      execute: (input) => asToolResult(() => this.faq.lookupServices(input)),
    });

    const logCallbackTool = tool({
      name: 'logCallback',
      description:
        'Log a request for a human to call the caller back (name, phone, reason).',
      parameters: LogCallbackInput,
      execute: (input) => asToolResult(() => this.callback.logCallback(input)),
    });

    const servicesAgent = new RealtimeAgent({
      name: agents.services.name,
      voice,
      handoffDescription: agents.services.handoffDescription,
      instructions: agents.services.instructions,
      tools: [lookupServicesTool, lookupFaqTool],
    });

    const escalationAgent = new RealtimeAgent({
      name: agents.escalation.name,
      voice,
      handoffDescription: agents.escalation.handoffDescription,
      instructions: agents.escalation.instructions,
      tools: [logCallbackTool],
    });

    const frontDeskAgent = new RealtimeAgent({
      name: agents.frontDesk.name,
      voice,
      handoffDescription: agents.frontDesk.handoffDescription,
      instructions: agents.frontDesk.instructions,
      tools: [
        checkAvailabilityTool,
        bookSlotTool,
        sendConfirmationTool,
        lookupBookingTool,
        rescheduleBookingTool,
        cancelBookingTool,
        // Read-only lookups on the front desk too, so service/pricing/FAQ
        // questions are always answered directly without depending on a handoff.
        lookupServicesTool,
        lookupFaqTool,
      ],
      handoffs: [servicesAgent, escalationAgent],
    });

    // Bidirectional handoffs so specialists can return control to the front desk.
    servicesAgent.handoffs.push(frontDeskAgent);
    escalationAgent.handoffs.push(frontDeskAgent);

    return frontDeskAgent;
  }
}
