import { Injectable } from '@nestjs/common';
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
} from '@voice-agent/shared';
import { AvailabilityService } from '../tools/availability.service';
import { BookingService } from '../tools/booking.service';
import { CallbackService } from '../tools/callback.service';
import { ConfirmationService } from '../tools/confirmation.service';
import { FaqService } from '../tools/faq.service';
import { ToolError } from '../common/tool-error';

const OFF_TOPIC = [
  'weather',
  'stock',
  'politics',
  'joke',
  'recipe',
  'sports score',
];

// One consistent voice across ALL agents. The realtime session re-sends `voice`
// on every handoff, and voice cannot change after a session begins — mismatched
// or unset voices make the post-handoff session update fail and the call stalls.
const VOICE = 'alloy';

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
 * Builds the server-side RealtimeAgents (research.md D3). Tools execute natively
 * in NestJS by calling the injected providers directly — no HTTP proxy. Destructive
 * tools use `needsApproval` for human-in-the-loop, and the providers remain the
 * authoritative guardrail (no-double-book) regardless of model behaviour.
 */
@Injectable()
export class VoiceAgentsService {
  constructor(
    private readonly availability: AvailabilityService,
    private readonly booking: BookingService,
    private readonly faq: FaqService,
    private readonly confirmation: ConfirmationService,
    private readonly callback: CallbackService,
  ) {}

  /** Stay-in-domain output guardrail (Constitution III, FR-013). */
  readonly stayInDomainGuardrail: RealtimeOutputGuardrail = {
    name: 'stay_in_domain',
    policyHint:
      'Only help with salon/spa bookings, rescheduling, cancellations, services, pricing, and FAQs.',
    execute: ({ agentOutput }) => {
      const text =
        typeof agentOutput === 'string' ? agentOutput.toLowerCase() : '';
      return Promise.resolve({
        tripwireTriggered: OFF_TOPIC.some((w) => text.includes(w)),
        outputInfo: {},
      });
    },
  };

  /** Create a fresh triage agent (with its specialist handoffs) per session. */
  buildTriageAgent(): RealtimeAgent {
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

    // Destructive → human-in-the-loop approval. The human approval is the
    // confirmation gate, so we pass confirmed: true once the SDK runs execute
    // (which only happens after session.approve()).
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
      name: 'ServicesAgent',
      voice: VOICE,
      handoffDescription:
        'Specialist for detailed services, packages, and pricing questions.',
      instructions:
        'You are the services and pricing specialist for a salon and spa. The MOMENT you take over the call, speak right away: greet briefly ("Hi, this is our services specialist") and address the question that was just asked. ALWAYS call lookupServices / lookupFAQ before answering — never invent prices, hours, or policies. Prices are in cents (35000 = "$350"). As soon as the caller wants to book, reschedule, cancel, or asks anything outside services/pricing, transfer back to the FrontDeskAgent immediately. Keep replies short.',
      tools: [lookupServicesTool, lookupFaqTool],
    });

    const escalationAgent = new RealtimeAgent({
      name: 'EscalationAgent',
      voice: VOICE,
      handoffDescription: 'Takes a message / logs a callback when a human is needed.',
      instructions:
        'You take a message when the caller needs a human. The MOMENT you take over the call, speak right away: greet briefly ("Of course, I can take a message") and ask for what you need. Collect their name, phone number, and reason, then call logCallback and reassure them a team member will follow up (do not promise a time). As soon as that is done, or if they want to book/change an appointment, transfer back to the FrontDeskAgent.',
      tools: [logCallbackTool],
    });

    const frontDeskAgent = new RealtimeAgent({
      name: 'FrontDeskAgent',
      voice: VOICE,
      handoffDescription: 'The salon front desk that books, reschedules, and cancels appointments.',
      instructions: [
        'You are the friendly front desk of a salon and spa. Keep spoken replies short and natural. You are the default agent and the one callers return to.',
        'GREETING: As soon as the call connects, speak first with a brief warm greeting, e.g. "Thanks for calling Bloom Salon and Spa — how can I help you today?" Do not wait for the caller to speak.',
        'BOOKING: Use checkAvailability to offer real open slots (never invent times). Collect service, chosen slot, name, and phone. ALWAYS read the booking back (service, day, time) and get a clear yes before calling bookSlot. After booking, call sendConfirmation and say a WhatsApp confirmation was sent. If bookSlot returns slot_taken, apologise and offer other slots — never overwrite.',
        'RESCHEDULE / CANCEL: First use lookupBooking with the caller name and phone (ask a clarifying question if more than one matches). Then call rescheduleBooking or cancelBooking — these require human approval before they take effect, so tell the caller you are putting the change through. For a reschedule, check the new time is free via checkAvailability.',
        'TRANSFERS (do this proactively): the MOMENT a caller asks about specific services, packages, bundles, or prices, transfer to ServicesAgent. If they ask for a human / to leave a message, transfer to EscalationAgent. Do not try to answer pricing/package questions yourself — transfer. Politely deflect clearly off-topic requests back to booking or FAQs.',
      ].join('\n'),
      tools: [
        checkAvailabilityTool,
        bookSlotTool,
        sendConfirmationTool,
        lookupBookingTool,
        rescheduleBookingTool,
        cancelBookingTool,
      ],
      handoffs: [servicesAgent, escalationAgent],
    });

    // Bidirectional handoffs: specialists can return control to the front desk.
    // (agent.handoffs is a mutable array; without this the conversation gets
    // stuck in a specialist after the first transfer.)
    servicesAgent.handoffs.push(frontDeskAgent);
    escalationAgent.handoffs.push(frontDeskAgent);

    return frontDeskAgent;
  }
}
