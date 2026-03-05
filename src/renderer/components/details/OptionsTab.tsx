import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Torrent } from '../../types/torrent';
import { useTorrentStore } from '../../stores/torrent-store';
import { formatBytes } from '../../lib/format';

interface Props {
  torrent: Torrent;
}

export function OptionsTab({ torrent: tor }: Props) {
  const { t } = useTranslation();
  const setTorrentProps = useTorrentStore((s) => s.setTorrentProps);

  const [downloadLimit, setDownloadLimit] = useState(tor.downloadLimit);
  const [downloadLimited, setDownloadLimited] = useState(tor.downloadLimited);
  const [uploadLimit, setUploadLimit] = useState(tor.uploadLimit);
  const [uploadLimited, setUploadLimited] = useState(tor.uploadLimited);
  const [seedRatioLimit, setSeedRatioLimit] = useState(tor.seedRatioLimit);
  const [seedRatioMode, setSeedRatioMode] = useState(tor.seedRatioMode);
  const [seedIdleLimit, setSeedIdleLimit] = useState(tor.seedIdleLimit);
  const [seedIdleMode, setSeedIdleMode] = useState(tor.seedIdleMode);
  const [peerLimit, setPeerLimit] = useState(tor.peerLimit);
  const [bandwidthPriority, setBandwidthPriority] = useState(tor.bandwidthPriority);
  const [honorsSessionLimits, setHonorsSessionLimits] = useState(tor.honorsSessionLimits);
  const [sequentialDownload, setSequentialDownload] = useState(tor.sequentialDownload);
  const [labelsText, setLabelsText] = useState(tor.labels?.join(', ') ?? '');

  const apply = () => {
    setTorrentProps([tor.id], {
      downloadLimit,
      downloadLimited,
      uploadLimit,
      uploadLimited,
      seedRatioLimit,
      seedRatioMode,
      seedIdleLimit,
      seedIdleMode,
      'peer-limit': peerLimit,
      bandwidthPriority,
      honorsSessionLimits,
      sequentialDownload,
      labels: labelsText.split(',').map((l) => l.trim()).filter(Boolean),
    });
  };

  return (
    <div className="text-xs space-y-3">
      {/* Bandwidth */}
      <div>
        <h4 className="font-medium mb-1">{t('optionsTab.bandwidth')}</h4>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={downloadLimited} onChange={(e) => setDownloadLimited(e.target.checked)} />
            {t('optionsTab.downloadLimit')}
            <input type="number" className="w-20 h-6 px-1 rounded border bg-background" value={downloadLimit} onChange={(e) => setDownloadLimit(Number(e.target.value))} disabled={!downloadLimited} />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={uploadLimited} onChange={(e) => setUploadLimited(e.target.checked)} />
            {t('optionsTab.uploadLimit')}
            <input type="number" className="w-20 h-6 px-1 rounded border bg-background" value={uploadLimit} onChange={(e) => setUploadLimit(Number(e.target.value))} disabled={!uploadLimited} />
          </label>
        </div>
        <label className="flex items-center gap-2 mt-1">
          <input type="checkbox" checked={honorsSessionLimits} onChange={(e) => setHonorsSessionLimits(e.target.checked)} />
          {t('optionsTab.honorSessionLimits')}
        </label>
        <div className="flex items-center gap-2 mt-1">
          {t('torrent.priority')}
          <select className="h-6 px-1 rounded border bg-background" value={bandwidthPriority} onChange={(e) => setBandwidthPriority(Number(e.target.value))}>
            <option value={-1}>{t('priority.low')}</option>
            <option value={0}>{t('priority.normal')}</option>
            <option value={1}>{t('priority.high')}</option>
          </select>
        </div>
      </div>

      {/* Seeding */}
      <div>
        <h4 className="font-medium mb-1">{t('optionsTab.seeding')}</h4>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {t('optionsTab.ratioMode')}
            <select className="h-6 px-1 rounded border bg-background" value={seedRatioMode} onChange={(e) => setSeedRatioMode(Number(e.target.value))}>
              <option value={0}>{t('optionsTab.global')}</option>
              <option value={1}>{t('optionsTab.custom')}</option>
              <option value={2}>{t('optionsTab.unlimited')}</option>
            </select>
            {seedRatioMode === 1 && (
              <input type="number" step="0.1" className="w-20 h-6 px-1 rounded border bg-background" value={seedRatioLimit} onChange={(e) => setSeedRatioLimit(Number(e.target.value))} />
            )}
          </div>
          <div className="flex items-center gap-2">
            {t('optionsTab.idleMode')}
            <select className="h-6 px-1 rounded border bg-background" value={seedIdleMode} onChange={(e) => setSeedIdleMode(Number(e.target.value))}>
              <option value={0}>{t('optionsTab.global')}</option>
              <option value={1}>{t('optionsTab.custom')}</option>
              <option value={2}>{t('optionsTab.unlimited')}</option>
            </select>
            {seedIdleMode === 1 && (
              <>
                <input type="number" className="w-20 h-6 px-1 rounded border bg-background" value={seedIdleLimit} onChange={(e) => setSeedIdleLimit(Number(e.target.value))} />
                <span className="text-muted-foreground">{t('optionsTab.minutes')}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Other */}
      <div>
        <h4 className="font-medium mb-1">{t('optionsTab.other')}</h4>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {t('optionsTab.maxPeers')}
            <input type="number" className="w-20 h-6 px-1 rounded border bg-background" value={peerLimit} onChange={(e) => setPeerLimit(Number(e.target.value))} />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={sequentialDownload} onChange={(e) => setSequentialDownload(e.target.checked)} />
            {t('optionsTab.sequentialDownload')}
          </label>
          <div className="flex items-center gap-2">
            {t('optionsTab.labelsLabel')}
            <input type="text" className="flex-1 h-6 px-1 rounded border bg-background" value={labelsText} onChange={(e) => setLabelsText(e.target.value)} placeholder={t('optionsTab.labelsPlaceholder')} />
          </div>
        </div>
      </div>

      <div className="pt-2 border-t">
        <button
          className="h-7 px-4 text-xs rounded bg-primary text-primary-foreground hover:opacity-90"
          onClick={apply}
        >
          {t('dialog.apply')}
        </button>
      </div>
    </div>
  );
}
