'use client';

import { useState } from 'react';
import { BACKEND_URL } from '@/lib/config';

export function SeedButton() {
  const [busy, setBusy] = useState(false);
  const reseed = async () => {
    setBusy(true);
    try { await fetch(`${BACKEND_URL}/seed`, { method: 'POST' }); }
    finally { setBusy(false); }
  };
  return (
    <button
      onClick={reseed}
      disabled={busy}
      className="shrink-0 rounded-md border border-border bg-secondary px-3 py-1.5 font-mono text-[11px] text-muted-foreground transition hover:border-primary/30 hover:text-foreground disabled:opacity-40 active:scale-95"
    >
      {busy ? 'Resetting…' : 'Reset demo'}
    </button>
  );
}
