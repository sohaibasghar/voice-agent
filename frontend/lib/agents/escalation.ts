'use client';

import { RealtimeAgent } from '@openai/agents-realtime';
import { logCallbackTool } from '@/lib/tools/info-tools';

/** Escalation specialist (US3, FR-013a) — takes a message for a human. */
export const escalationAgent = new RealtimeAgent({
  name: 'EscalationAgent',
  handoffDescription:
    'Takes a message and logs a callback request when the caller needs to speak to a human.',
  instructions: [
    'You handle requests that need a human follow-up.',
    'Collect the caller name, phone number, and the reason they want a callback.',
    'Call logCallback to record the request, then reassure them a team member will follow up.',
    'Do not promise a specific time. When done, hand back to the front desk.',
  ].join(' '),
  tools: [logCallbackTool],
});
