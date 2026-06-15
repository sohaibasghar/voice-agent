import { PhoneCall } from '@/components/phone-call';
import { SlotCards } from '@/components/slot-cards';
import { ApprovalsPanel } from '@/components/approvals-panel';
import { TracePanel } from '@/components/trace-panel';
import { ServicesMenu } from '@/components/services-menu';
import { SeedButton } from '@/components/seed-button';

export default function Home() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-10 flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs uppercase tracking-[0.25em] text-white/40">
            OpenAI Agents SDK · Realtime Voice
          </p>
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            Bloom Salon &amp; Spa
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/55">
            Call our front desk to book, reschedule, cancel, or ask about spa, bridal &amp;
            groom makeup, and packages. Specialists join the call via live handoffs, and
            destructive actions pause for your approval.
          </p>
        </div>
        <SeedButton />
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: the call */}
        <div className="space-y-6 lg:col-span-1">
          <PhoneCall />
          <ApprovalsPanel />
          <SlotCards />
        </div>

        {/* Middle: menu */}
        <div className="space-y-6 lg:col-span-1">
          <ServicesMenu />
        </div>

        {/* Right: trace */}
        <div className="lg:col-span-1">
          <TracePanel />
        </div>
      </div>
    </main>
  );
}
