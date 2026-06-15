'use client';

import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { voiceClient, type ApprovalRequest } from '@/lib/voice-client';

export function ApprovalsPanel() {
  const [pending, setPending] = useState<ApprovalRequest[]>([]);

  useEffect(() => {
    const off1 = voiceClient.on('approval', (a) =>
      setPending((prev) => [...prev.filter((p) => p.callId !== a.callId), a]),
    );
    const off2 = voiceClient.on('approvalResolved', (callId) =>
      setPending((prev) => prev.filter((p) => p.callId !== callId)),
    );
    return () => { off1(); off2(); };
  }, []);

  if (!pending.length) return null;

  return (
    <div className="surface-warn overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-amber-500/20 px-5 py-3.5">
        <ShieldAlert className="h-4 w-4 text-amber-400" strokeWidth={2} />
        <h3 className="text-sm font-semibold text-amber-300">Approval required</h3>
        <span className="label ml-auto text-amber-500/60">human-in-the-loop</span>
      </div>

      <div className="divide-y divide-border">
        {pending.map((a) => (
          <div key={a.callId} className="p-5">
            <p className="mb-2 font-mono text-sm font-medium text-foreground">{a.tool}</p>
            <pre className="mb-4 overflow-auto rounded border border-border bg-muted/50 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {JSON.stringify(a.args, null, 2)}
            </pre>
            <div className="flex gap-2">
              <button
                onClick={() => voiceClient.approve(a.callId)}
                className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-emerald-500 active:scale-95"
              >
                Approve
              </button>
              <button
                onClick={() => voiceClient.reject(a.callId, 'Rejected by operator')}
                className="rounded-md border border-border bg-secondary px-4 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground active:scale-95"
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
