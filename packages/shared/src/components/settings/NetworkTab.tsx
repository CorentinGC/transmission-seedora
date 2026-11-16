import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '../../stores/session-store';
import type { SessionSettings } from '../../types/session';
import { Button } from '../ui';
import { ApplyStatus, type ApplyState } from './ApplyStatus';

interface Props {
  settings: SessionSettings;
}

export function NetworkTab({ settings: s }: Props) {
  const { t } = useTranslation();
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
    setPortTestResult(t('networkTab.testing'));
    const res = await testPort();
    const data = res.data as { 'port-is-open'?: boolean } | undefined;
    setPortTestResult(data?.['port-is-open'] ? t('networkTab.portOpen') : t('networkTab.portClosed'));
  };

  const handleUpdateBlocklist = async () => {
    setBlocklistResult(t('networkTab.updating'));
    const res = await updateBlocklist();
    const data = res.data as { 'blocklist-size'?: number } | undefined;
    setBlocklistResult(
      res.success
        ? t('networkTab.updatedEntries', { count: data?.['blocklist-size'] ?? 0 })
        : t('networkTab.updateFailed'),
    );
  };

  const [applyStatus, setApplyStatus] = useState<ApplyState>('idle');

  const apply = async () => {
    const ok = await updateSettings({
      peerPort,
      peerPortRandomOnStart,
      portForwardingEnabled,
      encryption,
      dhtEnabled,
      pexEnabled,
      lpdEnabled,
      peerLimitGlobal,
      peerLimitPerTorrent,
      blocklistEnabled,
      blocklistUrl,
    });
    setApplyStatus(ok ? 'success' : 'error');
    setTimeout(() => setApplyStatus('idle'), 3000);
  };

  return (
    <div className="space-y-4 text-sm">
      <div>
        <h3 className="font-medium mb-2">{t('networkTab.listeningPort')}</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {t('networkTab.port')}
            <input
              type="number"
              aria-label={t('networkTab.port')}
              className="w-24 h-7 px-2 rounded border bg-background"
              value={peerPort}
              onChange={(e) => setPeerPort(Number(e.target.value))}
            />
            <Button size="sm" onClick={handleTestPort}>
              {t('networkTab.testPort')}
            </Button>
            <span role="status" className="text-xs text-muted-foreground">
              {portTestResult}
            </span>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={peerPortRandomOnStart}
              onChange={(e) => setPeerPortRandomOnStart(e.target.checked)}
            />
            {t('networkTab.randomPort')}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={portForwardingEnabled}
              onChange={(e) => setPortForwardingEnabled(e.target.checked)}
            />
            {t('networkTab.enableUpnp')}
          </label>
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-medium mb-2">{t('networkTab.encryption')}</h3>
        <select
          aria-label={t('networkTab.encryption')}
          className="h-7 px-2 rounded border bg-background"
          value={encryption}
          onChange={(e) => setEncryption(e.target.value)}
        >
          <option value="tolerated">{t('networkTab.allowEncryption')}</option>
          <option value="preferred">{t('networkTab.preferEncryption')}</option>
          <option value="required">{t('networkTab.requireEncryption')}</option>
        </select>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-medium mb-2">{t('networkTab.protocol')}</h3>
        <div className="space-y-1">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={dhtEnabled} onChange={(e) => setDhtEnabled(e.target.checked)} />{' '}
            {t('networkTab.enableDht')}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={pexEnabled} onChange={(e) => setPexEnabled(e.target.checked)} />{' '}
            {t('networkTab.enablePex')}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={lpdEnabled} onChange={(e) => setLpdEnabled(e.target.checked)} />{' '}
            {t('networkTab.enableLpd')}
          </label>
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-medium mb-2">{t('networkTab.peerLimits')}</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            {t('networkTab.global')}{' '}
            <input
              type="number"
              className="w-24 h-7 px-2 rounded border bg-background"
              value={peerLimitGlobal}
              onChange={(e) => setPeerLimitGlobal(Number(e.target.value))}
            />
          </label>
          <label className="flex items-center gap-2">
            {t('networkTab.perTorrent')}{' '}
            <input
              type="number"
              className="w-24 h-7 px-2 rounded border bg-background"
              value={peerLimitPerTorrent}
              onChange={(e) => setPeerLimitPerTorrent(Number(e.target.value))}
            />
          </label>
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-medium mb-2">{t('networkTab.blocklist')}</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={blocklistEnabled} onChange={(e) => setBlocklistEnabled(e.target.checked)} />
            {t('networkTab.enableBlocklist')}
          </label>
          {blocklistEnabled && (
            <div className="space-y-1">
              <input
                type="text"
                className="w-full h-7 px-2 rounded border bg-background"
                value={blocklistUrl}
                onChange={(e) => setBlocklistUrl(e.target.value)}
                aria-label={t('networkTab.blocklistUrl')}
                placeholder={t('networkTab.blocklistUrl')}
              />
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleUpdateBlocklist}>
                  {t('networkTab.updateBlocklist')}
                </Button>
                <span role="status" className="text-xs text-muted-foreground">
                  {blocklistResult}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t('networkTab.entries', { count: s.blocklistSize })}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t pt-4 flex items-center gap-3">
        <Button variant="primary" onClick={apply}>
          {t('dialog.apply')}
        </Button>
        <ApplyStatus status={applyStatus} />
      </div>
    </div>
  );
}
