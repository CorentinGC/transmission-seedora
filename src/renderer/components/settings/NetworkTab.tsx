import { useState } from 'react';
import { useSessionStore } from '../../stores/session-store';
import type { SessionSettings } from '../../types/session';

interface Props {
  settings: SessionSettings;
}

export function NetworkTab({ settings: s }: Props) {
  const updateSettings = useSessionStore((st) => st.updateSettings);
  const testPort = useSessionStore((st) => st.testPort);
  const updateBlocklist = useSessionStore((st) => st.updateBlocklist);

  const [peerPort, setPeerPort] = useState(s.peerPort);
  const [peerPortRandomOnStart, setPeerPortRandomOnStart] = useState(s.peerPortRandomOnStart);
  const [portForwardingEnabled, setPortForwardingEnabled] = useState(s.portForwardingEnabled);
  const [encryption, setEncryption] = useState(s.encryption);
  const [dhtEnabled, setDhtEnabled] = useState(s.dhtEnabled);
  const [pexEnabled, setPexEnabled] = useState(s.pexEnabled);
  const [lpdEnabled, setLpdEnabled] = useState(s.lpdEnabled);
  const [peerLimitGlobal, setPeerLimitGlobal] = useState(s.peerLimitGlobal);
  const [peerLimitPerTorrent, setPeerLimitPerTorrent] = useState(s.peerLimitPerTorrent);
  const [blocklistEnabled, setBlocklistEnabled] = useState(s.blocklistEnabled);
  const [blocklistUrl, setBlocklistUrl] = useState(s.blocklistUrl);

  const [portTestResult, setPortTestResult] = useState<string | null>(null);
  const [blocklistResult, setBlocklistResult] = useState<string | null>(null);

  const handleTestPort = async () => {
    setPortTestResult('Testing...');
    const res = await testPort();
    const data = res.data as { 'port-is-open'?: boolean } | undefined;
    setPortTestResult(data?.['port-is-open'] ? 'Port is open' : 'Port is closed');
  };

  const handleUpdateBlocklist = async () => {
    setBlocklistResult('Updating...');
    const res = await updateBlocklist();
    const data = res.data as { 'blocklist-size'?: number } | undefined;
    setBlocklistResult(
      res.success ? `Updated: ${data?.['blocklist-size'] ?? 0} entries` : 'Failed',
    );
  };

  const apply = () => {
    updateSettings({
      'peer-port': peerPort,
      'peer-port-random-on-start': peerPortRandomOnStart,
      'port-forwarding-enabled': portForwardingEnabled,
      encryption,
      'dht-enabled': dhtEnabled,
      'pex-enabled': pexEnabled,
      'lpd-enabled': lpdEnabled,
      'peer-limit-global': peerLimitGlobal,
      'peer-limit-per-torrent': peerLimitPerTorrent,
      'blocklist-enabled': blocklistEnabled,
      'blocklist-url': blocklistUrl,
    });
  };

  return (
    <div className="space-y-4 text-sm">
      <div>
        <h3 className="font-medium mb-2">Listening Port</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            Port:
            <input type="number" className="w-24 h-7 px-2 rounded border bg-background" value={peerPort} onChange={(e) => setPeerPort(Number(e.target.value))} />
            <button className="h-7 px-3 text-xs rounded border hover:bg-accent" onClick={handleTestPort}>
              Test Port
            </button>
            {portTestResult && <span className="text-xs text-muted-foreground">{portTestResult}</span>}
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={peerPortRandomOnStart} onChange={(e) => setPeerPortRandomOnStart(e.target.checked)} />
            Random port on start
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={portForwardingEnabled} onChange={(e) => setPortForwardingEnabled(e.target.checked)} />
            Enable UPnP / NAT-PMP port forwarding
          </label>
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-medium mb-2">Encryption</h3>
        <select className="h-7 px-2 rounded border bg-background" value={encryption} onChange={(e) => setEncryption(e.target.value)}>
          <option value="tolerated">Allow encryption</option>
          <option value="preferred">Prefer encryption</option>
          <option value="required">Require encryption</option>
        </select>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-medium mb-2">Protocol</h3>
        <div className="space-y-1">
          <label className="flex items-center gap-2"><input type="checkbox" checked={dhtEnabled} onChange={(e) => setDhtEnabled(e.target.checked)} /> Enable DHT</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={pexEnabled} onChange={(e) => setPexEnabled(e.target.checked)} /> Enable PEX</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={lpdEnabled} onChange={(e) => setLpdEnabled(e.target.checked)} /> Enable LPD</label>
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-medium mb-2">Peer Limits</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            Global: <input type="number" className="w-24 h-7 px-2 rounded border bg-background" value={peerLimitGlobal} onChange={(e) => setPeerLimitGlobal(Number(e.target.value))} />
          </div>
          <div className="flex items-center gap-2">
            Per torrent: <input type="number" className="w-24 h-7 px-2 rounded border bg-background" value={peerLimitPerTorrent} onChange={(e) => setPeerLimitPerTorrent(Number(e.target.value))} />
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-medium mb-2">Blocklist</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={blocklistEnabled} onChange={(e) => setBlocklistEnabled(e.target.checked)} />
            Enable blocklist
          </label>
          {blocklistEnabled && (
            <div className="space-y-1">
              <input type="text" className="w-full h-7 px-2 rounded border bg-background" value={blocklistUrl} onChange={(e) => setBlocklistUrl(e.target.value)} placeholder="Blocklist URL" />
              <div className="flex items-center gap-2">
                <button className="h-7 px-3 text-xs rounded border hover:bg-accent" onClick={handleUpdateBlocklist}>Update Blocklist</button>
                {blocklistResult && <span className="text-xs text-muted-foreground">{blocklistResult}</span>}
                <span className="text-xs text-muted-foreground">{s.blocklistSize} entries</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t pt-4">
        <button className="h-8 px-4 text-sm rounded bg-primary text-primary-foreground hover:opacity-90" onClick={apply}>Apply</button>
      </div>
    </div>
  );
}
