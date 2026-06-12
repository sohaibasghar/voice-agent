'use client';

import { tool } from '@openai/agents-realtime';
import {
  LogCallbackInput,
  LookupFaqInput,
  LookupServicesInput,
} from '@voice-agent/shared';
import { callTool } from './proxy';

/** US3 tools — grounded FAQ/services + escalation callback. */

export const lookupFaqTool = tool({
  name: 'lookupFAQ',
  description:
    'Look up a grounded answer about hours, location, parking, payment, or cancellation policy. If it returns null, tell the caller you do not have that information rather than guessing.',
  parameters: LookupFaqInput,
  execute: (input) => callTool('lookupFAQ', input),
});

export const lookupServicesTool = tool({
  name: 'lookupServices',
  description:
    'Look up service, pricing, and package information. Only state prices and details returned by this tool — never invent them.',
  parameters: LookupServicesInput,
  execute: (input) => callTool('lookupServices', input),
});

export const logCallbackTool = tool({
  name: 'logCallback',
  description:
    'Log a request for a human to call the caller back. Capture their name, phone contact, and the reason.',
  parameters: LogCallbackInput,
  execute: (input) => callTool('logCallback', input),
});
