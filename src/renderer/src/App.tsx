import { useEffect, useState } from 'react';

export default function App() {
  // Phase 0 — foundation verification state
  const [pong, setPong] = useState<string | null>(null);
  const [launchCount, setLaunchCount] = useState<number | null>(null);

  // Phase 3 — launcher state
  const [liveCount, setLiveCount] = useState<number>(0);
  const [launchError, setLaunchError] = useState<string | null>(null);

  useEffect(() => {
    // Phase 0: round-trip smoke tests
    window.api.ping().then(setPong).catch(() => setPong('FAIL'));
    window.api.getLaunchCount().then(setLaunchCount).catch(() => setLaunchCount(-1));
  }, []);

  useEffect(() => {
    // Phase 3: subscribe to instance-closed push events from main.
    // The returned unsubscribe fn is the useEffect cleanup — called on
    // component unmount or on effect re-run.
    const unsubscribe = window.api.onInstanceClosed((_id: string) => {
      setLiveCount((prev) => Math.max(0, prev - 1));
    });
    return unsubscribe;
  }, []);

  const handleLaunch = async (): Promise<void> => {
    try {
      await window.api.launch({ latitude: 35.6762, longitude: 139.6503 });
      setLiveCount((prev) => prev + 1);
      setLaunchError(null);
    } catch (err) {
      setLaunchError(err instanceof Error ? err.message : String(err));
    }
  };

  const protocol = window.location.protocol;

  return (
    <main style={{ fontFamily: 'system-ui', padding: 24 }}>
      <h1>AntiClicker — Foundation OK</h1>

      {/* Phase 0 verification rows */}
      <dl>
        <dt>window.location.protocol</dt>
        <dd data-testid="protocol">{protocol}</dd>
        <dt>window.api.ping()</dt>
        <dd data-testid="ping">{pong ?? '…'}</dd>
        <dt>electron-store launchCount</dt>
        <dd data-testid="launch-count">{launchCount ?? '…'}</dd>
      </dl>

      {/* Phase 3 launcher section */}
      <section style={{ marginTop: 24 }}>
        <h2>Launcher</h2>
        <button
          data-testid="launch-button"
          onClick={() => void handleLaunch()}
          style={{ padding: '8px 16px', cursor: 'pointer' }}
        >
          Launch at Tokyo (35.6762, 139.6503)
        </button>
        {launchError && (
          <p data-testid="launch-error" style={{ color: 'red' }}>
            {launchError}
          </p>
        )}
        <dl>
          <dt>live instances</dt>
          <dd data-testid="live-instances">{liveCount}</dd>
        </dl>
      </section>
    </main>
  );
}
