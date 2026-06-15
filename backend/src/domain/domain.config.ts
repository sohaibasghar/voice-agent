export const DOMAIN_CONFIG = Symbol('DOMAIN_CONFIG');

export interface SeedService {
  name: string;
  category: string;
  durationMin: number;
  price: number; // minor units (cents)
}

export interface SeedFaq {
  topic: string;
  answer: string;
}

export interface SeedBookingSpec {
  serviceName: string;
  customerName: string;
  contact: string;
  startTime: Date;
  durationMin: number;
}

export interface AgentConfig {
  name: string;
  instructions: string;
  handoffDescription: string;
}

export interface DomainConfig {
  /** Display name used in agent greetings and policyHint. */
  businessName: string;

  /**
   * OpenAI Realtime voice — must be identical across all agents in a session.
   * The SDK resends `voice` on every handoff; a mismatch stalls the session.
   */
  voice: string;

  agents: {
    frontDesk: AgentConfig;
    services: AgentConfig;
    escalation: AgentConfig;
  };

  guardrail: {
    /** Words that trip the stay-in-domain guardrail when found in model output. */
    offTopicKeywords: string[];
    /** Plain-English policy hint sent to the guardrail function. */
    policyHint: string;
  };

  /**
   * Part-of-day windows as [startMinute, endMinute) from midnight.
   * Keys must match the PartOfDay union in shared schemas.
   */
  partOfDay: Record<string, [number, number]>;

  /** Category render order for the catalog UI. Unknown categories sort last. */
  categoryOrder: string[];

  seed: {
    services: SeedService[];
    faqs: SeedFaq[];
    /** Called at seed time so booking start times are always in the future. */
    bookings: (base?: Date) => SeedBookingSpec[];
  };
}
