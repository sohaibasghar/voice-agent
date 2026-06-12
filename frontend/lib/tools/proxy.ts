'use client';

import { BACKEND_URL } from '@/lib/config';
import { traceRelay } from '@/lib/trace/relay';

/**
 * Calls a backend tool endpoint and relays the call + result (or guardrail trip)
 * to the trace. This is the thin client-side proxy described in research.md D4:
 * the real logic and guardrails live in the NestJS provider behind /tools/<name>.
 * Returns a string for the model (the SDK tool contract expects string output).
 */
export async function callTool(name: string, input: unknown): Promise<string> {
  traceRelay.emit('tool_call', name, { args: input });
  try {
    const res = await fetch(`${BACKEND_URL}/tools/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await res.json();

    if (!res.ok) {
      // Authoritative guardrail / validation rejection (e.g. slot_taken,
      // not_confirmed). Surface as a guardrail trip and hand the model a
      // structured error it can act on (re-offer, ask for confirmation).
      const code = data?.code ?? 'error';
      traceRelay.emit('guardrail_trip', name, { detail: code, result: data });
      return JSON.stringify({ error: code, message: data?.message ?? code });
    }

    traceRelay.emit('tool_result', name, { result: data });
    return JSON.stringify(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'network_error';
    traceRelay.emit('tool_result', name, { result: { error: message } });
    return JSON.stringify({ error: 'network_error', message });
  }
}
