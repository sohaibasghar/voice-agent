import { VoiceConsole } from '@/components/voice-console';
import { SlotCards } from '@/components/slot-cards';
import { TracePanel } from '@/components/trace-panel';

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Voice Front-Desk Agent</h1>
        <p className="text-sm text-muted-foreground">
          Salon &amp; spa booking by voice — book, reschedule, cancel, and ask
          questions. Watch tools, handoffs, and guardrails fire in the trace.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <VoiceConsole />
          <SlotCards />
        </div>
        <TracePanel />
      </div>
    </main>
  );
}
