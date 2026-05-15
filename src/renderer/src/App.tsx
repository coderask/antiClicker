import { useEffect, useState } from 'react';

export default function App() {
  const [pong, setPong] = useState<string | null>(null);
  const [launchCount, setLaunchCount] = useState<number | null>(null);

  useEffect(() => {
    window.api.ping().then(setPong).catch(() => setPong('FAIL'));
    window.api.getLaunchCount().then(setLaunchCount).catch(() => setLaunchCount(-1));
  }, []);

  const protocol = window.location.protocol;

  return (
    <main style={{ fontFamily: 'system-ui', padding: 24 }}>
      <h1>AntiClicker — Foundation OK</h1>
      <dl>
        <dt>window.location.protocol</dt>
        <dd data-testid="protocol">{protocol}</dd>
        <dt>window.api.ping()</dt>
        <dd data-testid="ping">{pong ?? '…'}</dd>
        <dt>electron-store launchCount</dt>
        <dd data-testid="launch-count">{launchCount ?? '…'}</dd>
      </dl>
    </main>
  );
}
