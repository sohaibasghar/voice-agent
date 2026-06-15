import { PhoneCall } from '@/components/phone-call';
import { SlotCards } from '@/components/slot-cards';
import { ApprovalsPanel } from '@/components/approvals-panel';
import { TracePanel } from '@/components/trace-panel';
import { SeedButton } from '@/components/seed-button';

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      {/* Header */}
      <header className="mb-8 flex items-start justify-between gap-6">
        <div>
          <div className="label mb-2">OpenAI Agents SDK · Realtime Voice</div>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground">
            Bloom Salon{' '}
            <em className="not-italic text-primary">&amp;</em>{' '}
            Spa
          </h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Call the front desk to book, reschedule, or cancel. Specialists join via
            live handoffs. Destructive actions require your approval.
          </p>
        </div>
        <SeedButton />
      </header>

      <hr className="mb-8 border-border" />

      {/* Row 1 — voice interface (centered) */}
      <div className="mb-6 flex flex-col items-center gap-5">
        <div className="w-full max-w-sm">
          <PhoneCall />
        </div>
        <div className="w-full max-w-sm space-y-5">
          <ApprovalsPanel />
          <SlotCards />
        </div>
      </div>

      {/* Row 2 — live trace */}
      <TracePanel />
    </main>
  );
}
