'use client';

import { RealtimeAgent } from '@openai/agents-realtime';
import { lookupFaqTool, lookupServicesTool } from '@/lib/tools/info-tools';

/** Services specialist (US3) — detailed service/pricing/package questions, grounded. */
export const servicesAgent = new RealtimeAgent({
  name: 'ServicesAgent',
  handoffDescription:
    'Answers detailed questions about services, packages, and pricing using grounded data.',
  instructions: [
    'You are the services and pricing specialist for a salon and spa.',
    'Answer questions about services, packages, durations, and prices.',
    'ALWAYS use the lookupServices and lookupFAQ tools — never invent prices, hours, or policies.',
    'Prices from the tools are in cents; say them naturally (e.g. 35000 = "$350").',
    'When the caller is ready to book or change an appointment, hand back to the front desk.',
    'Keep spoken replies concise.',
  ].join(' '),
  tools: [lookupServicesTool, lookupFaqTool],
});
