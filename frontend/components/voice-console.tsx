'use client';

import { useCallback, useRef, useState } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { startVoiceSession, type SessionHandle, type SessionStatus } from '@/lib/session';
import { BACKEND_URL } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const STATUS_LABEL: Record<SessionStatus, string> = {
  idle: 'Idle',
  connecting: 'Connecting…',
  connected: 'Listening',
  error: 'Error',
};

/** Talk control + status (US1 / FR-002 barge-in indicator). */
export function VoiceConsole() {
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [bargeIn, setBargeIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleRef = useRef<SessionHandle | null>(null);

  const start = useCallback(async () => {
    setError(null);
    try {
      handleRef.current = await startVoiceSession({
        onStatus: setStatus,
        onInterrupted: () => {
          setBargeIn(true);
          setTimeout(() => setBargeIn(false), 800);
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start session');
      setStatus('error');
    }
  }, []);

  const stop = useCallback(async () => {
    await handleRef.current?.disconnect();
    handleRef.current = null;
  }, []);

  const reseed = useCallback(async () => {
    await fetch(`${BACKEND_URL}/seed`, { method: 'POST' });
  }, []);

  const connected = status === 'connected';
  const busy = status === 'connecting';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Front Desk</span>
          <Badge variant={connected ? 'default' : status === 'error' ? 'destructive' : 'secondary'}>
            {STATUS_LABEL[status]}
            {bargeIn ? ' · barge-in' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          {!connected && !busy && (
            <Button onClick={start}>
              <Mic className="h-4 w-4" /> Talk
            </Button>
          )}
          {busy && (
            <Button disabled>
              <Loader2 className="h-4 w-4 animate-spin" /> Connecting
            </Button>
          )}
          {connected && (
            <Button variant="destructive" onClick={stop}>
              <MicOff className="h-4 w-4" /> End call
            </Button>
          )}
          <Button variant="outline" onClick={reseed} disabled={connected}>
            Reset demo data
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <p className="text-sm text-muted-foreground">
          Click Talk and allow the microphone, then speak naturally — e.g.
          “I&apos;d like a haircut Thursday afternoon.” You can interrupt the agent at any time.
        </p>
      </CardContent>
    </Card>
  );
}
