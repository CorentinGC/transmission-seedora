import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '../../stores/session-store';
import type { SessionSettings } from '../../types/session';

interface Props {
  settings: SessionSettings;
}

export function QueueTab({ settings: s }: Props) {
  const { t } = useTranslation();
  const updateSettings = useSessionStore((st) => st.updateSettings);

  const [downloadQueueEnabled, setDownloadQueueEnabled] = useState(s.downloadQueueEnabled);
  const [downloadQueueSize, setDownloadQueueSize] = useState(s.downloadQueueSize);
  const [seedQueueEnabled, setSeedQueueEnabled] = useState(s.seedQueueEnabled);
  const [seedQueueSize, setSeedQueueSize] = useState(s.seedQueueSize);
  const [queueStalledEnabled, setQueueStalledEnabled] = useState(s.queueStalledEnabled);
  const [queueStalledMinutes, setQueueStalledMinutes] = useState(s.queueStalledMinutes);
  const [seedRatioLimited, setSeedRatioLimited] = useState(s.seedRatioLimited);
  const [seedRatioLimit, setSeedRatioLimit] = useState(s.seedRatioLimit);
  const [idleSeedingLimitEnabled, setIdleSeedingLimitEnabled] = useState(s.idleSeedingLimitEnabled);
  const [idleSeedingLimit, setIdleSeedingLimit] = useState(s.idleSeedingLimit);

  const apply = () => {
    updateSettings({
      'download-queue-enabled': downloadQueueEnabled,
      'download-queue-size': downloadQueueSize,
      'seed-queue-enabled': seedQueueEnabled,
      'seed-queue-size': seedQueueSize,
      'queue-stalled-enabled': queueStalledEnabled,
      'queue-stalled-minutes': queueStalledMinutes,
      'seedRatioLimited': seedRatioLimited,
      'seedRatioLimit': seedRatioLimit,
      'idle-seeding-limit-enabled': idleSeedingLimitEnabled,
      'idle-seeding-limit': idleSeedingLimit,
    });
  };

  return (
    <div className="space-y-4 text-sm">
      <div>
        <h3 className="font-medium mb-2">{t('queueTab.downloadQueue')}</h3>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={downloadQueueEnabled} onChange={(e) => setDownloadQueueEnabled(e.target.checked)} />
          {t('queueTab.maxDownloads')}
          <input type="number" className="w-20 h-7 px-2 rounded border bg-background" value={downloadQueueSize} onChange={(e) => setDownloadQueueSize(Number(e.target.value))} disabled={!downloadQueueEnabled} />
        </label>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-medium mb-2">{t('queueTab.seedQueue')}</h3>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={seedQueueEnabled} onChange={(e) => setSeedQueueEnabled(e.target.checked)} />
          {t('queueTab.maxSeeds')}
          <input type="number" className="w-20 h-7 px-2 rounded border bg-background" value={seedQueueSize} onChange={(e) => setSeedQueueSize(Number(e.target.value))} disabled={!seedQueueEnabled} />
        </label>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-medium mb-2">{t('queueTab.stalledDetection')}</h3>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={queueStalledEnabled} onChange={(e) => setQueueStalledEnabled(e.target.checked)} />
          {t('queueTab.idleMinutes')}
          <input type="number" className="w-20 h-7 px-2 rounded border bg-background" value={queueStalledMinutes} onChange={(e) => setQueueStalledMinutes(Number(e.target.value))} disabled={!queueStalledEnabled} />
        </label>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-medium mb-2">{t('queueTab.seedingLimits')}</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={seedRatioLimited} onChange={(e) => setSeedRatioLimited(e.target.checked)} />
            {t('queueTab.stopAtRatio')}
            <input type="number" step="0.1" className="w-20 h-7 px-2 rounded border bg-background" value={seedRatioLimit} onChange={(e) => setSeedRatioLimit(Number(e.target.value))} disabled={!seedRatioLimited} />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={idleSeedingLimitEnabled} onChange={(e) => setIdleSeedingLimitEnabled(e.target.checked)} />
            {t('queueTab.stopIfIdle')}
            <input type="number" className="w-20 h-7 px-2 rounded border bg-background" value={idleSeedingLimit} onChange={(e) => setIdleSeedingLimit(Number(e.target.value))} disabled={!idleSeedingLimitEnabled} />
          </label>
        </div>
      </div>

      <div className="border-t pt-4">
        <button className="h-8 px-4 text-sm rounded bg-primary text-primary-foreground hover:opacity-90" onClick={apply}>{t('dialog.apply')}</button>
      </div>
    </div>
  );
}
