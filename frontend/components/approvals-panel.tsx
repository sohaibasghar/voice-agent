'use client';

import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { voiceClient, type ApprovalRequest } from '@/lib/voice-client';

/**
 * Human-in-the-loop (SDK tool approvals). Destructive tools (cancel/reschedule)
 * pause server-side via needsApproval; the request surfaces here for a human to
 * approve or reject before the tool runs (research.md D3).
 */
export function ApprovalsPanel() {
  const [pending, setPending] = useState<ApprovalRequest[]>([]);

  useEffect(() => {
    const off1 = voiceClient.on('approval', (a) =>
      setPending((prev) => [...prev.filter((p) => p.callId !== a.callId), a]),
    );
    const off2 = voiceClient.on('approvalResolved', (callId) =>
      setPending((prev) => prev.filter((p) => p.callId !== callId)),
    );
    return () => {
      off1();
      off2();
    };
  }, []);

  if (pending.length === 0) return null;

  return (
    <div className="glass border-amber-400/30 p-6 ring-1 ring-amber-400/20">
      <div className="mb-3 flex items-center gap-2">
        <ShieldAlert className="h-5 w-5 text-amber-300" />
        <h3 className="font-display text-lg font-semibold">Approval needed</h3>
        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-200">
          human-in-the-loop
        </span>
      </div>
      <div className="space-y-3">
        {pending.map((a) => (
          <div key={a.callId} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
            <p className="font-mono font-medium text-white/90">{a.tool}</p>
            <pre className="mt-1 overflow-auto rounded-lg bg-black/30 p-2 text-[11px] text-white/70">
              {JSON.stringify(a.args, null, 2)}
            </pre>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => voiceClient.approve(a.callId)}
                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-400"
              >
                Approve
              </button>
              <button
                onClick={() => voiceClient.reject(a.callId, 'Rejected by operator')}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-white/80 transition hover:bg-white/10"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
