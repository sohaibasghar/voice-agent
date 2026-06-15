'use client';

import { useState } from 'react';
import { BACKEND_URL } from '@/lib/config';
import { Button } from '@/components/ui/button';

/** Reset demo data to a known state between runs (FR-017, SC-009). */
export function SeedButton() {
  const [busy, setBusy] = useState(false);
  const reseed = async () => {
    setBusy(true);
    try {
      await fetch(`${BACKEND_URL}/seed`, { method: 'POST' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant="outline" size="sm" onClick={reseed} disabled={busy}>
      {busy ? 'Resetting…' : 'Reset demo data'}
    </Button>
  );
}
