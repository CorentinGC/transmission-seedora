import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Torrent } from '../../types/torrent';
import { useTorrentStore } from '../../stores/torrent-store';

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

  /** Puts every field back to the values the daemon last reported for this torrent. */
  const revert = () => {
    setDownloadLimit(tor.downloadLimit);
    setDownloadLimited(tor.downloadLimited);
    setUploadLimit(tor.uploadLimit);
    setUploadLimited(tor.uploadLimited);
    setSeedRatioLimit(tor.seedRatioLimit);
    setSeedRatioMode(tor.seedRatioMode);
    setSeedIdleLimit(tor.seedIdleLimit);
    setSeedIdleMode(tor.seedIdleMode);
    setPeerLimit(tor.peerLimit);
    setBandwidthPriority(tor.bandwidthPriority);
    setHonorsSessionLimits(tor.honorsSessionLimits);
    setSequentialDownload(tor.sequentialDownload);
    setLabelsText(tor.labels?.join(', ') ?? '');
  };

  const apply = async () => {
    // The store notifies the user of a failure; the form must not keep showing values the daemon refused.
    const ok = await setTorrentProps([tor.id], {
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
      labels: labelsText
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean),
    });
    if (!ok) revert();
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
            <input
              type="number"
              aria-label={t('optionsTab.downloadLimit')}
              className="w-20 h-6 px-1 rounded border bg-background"
              value={downloadLimit}
              onChange={(e) => setDownloadLimit(Number(e.target.value))}
              disabled={!downloadLimited}
            />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={uploadLimited} onChange={(e) => setUploadLimited(e.target.checked)} />
            {t('optionsTab.uploadLimit')}
            <input
              type="number"
              aria-label={t('optionsTab.uploadLimit')}
              className="w-20 h-6 px-1 rounded border bg-background"
              value={uploadLimit}
              onChange={(e) => setUploadLimit(Number(e.target.value))}
              disabled={!uploadLimited}
            />
          </label>
        </div>
        <label className="flex items-center gap-2 mt-1">
          <input
            type="checkbox"
            checked={honorsSessionLimits}
            onChange={(e) => setHonorsSessionLimits(e.target.checked)}
          />
          {t('optionsTab.honorSessionLimits')}
        </label>
        <label className="flex items-center gap-2 mt-1">
          {t('torrent.priority')}
          <select
            className="h-6 px-1 rounded border bg-background"
            value={bandwidthPriority}
            onChange={(e) => setBandwidthPriority(Number(e.target.value))}
          >
            <option value={-1}>{t('priority.low')}</option>
            <option value={0}>{t('priority.normal')}</option>
            <option value={1}>{t('priority.high')}</option>
          </select>
        </label>
      </div>

      {/* Seeding */}
      <div>
        <h4 className="font-medium mb-1">{t('optionsTab.seeding')}</h4>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {t('optionsTab.ratioMode')}
            <select
              aria-label={t('optionsTab.ratioMode')}
              className="h-6 px-1 rounded border bg-background"
              value={seedRatioMode}
              onChange={(e) => setSeedRatioMode(Number(e.target.value))}
            >
              <option value={0}>{t('optionsTab.global')}</option>
              <option value={1}>{t('optionsTab.custom')}</option>
              <option value={2}>{t('optionsTab.unlimited')}</option>
            </select>
            {seedRatioMode === 1 && (
              <input
                type="number"
                step="0.1"
                aria-label={t('optionsTab.ratioLimit')}
                className="w-20 h-6 px-1 rounded border bg-background"
                value={seedRatioLimit}
                onChange={(e) => setSeedRatioLimit(Number(e.target.value))}
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            {t('optionsTab.idleMode')}
            <select
              aria-label={t('optionsTab.idleMode')}
              className="h-6 px-1 rounded border bg-background"
              value={seedIdleMode}
              onChange={(e) => setSeedIdleMode(Number(e.target.value))}
            >
              <option value={0}>{t('optionsTab.global')}</option>
              <option value={1}>{t('optionsTab.custom')}</option>
              <option value={2}>{t('optionsTab.unlimited')}</option>
            </select>
            {seedIdleMode === 1 && (
              <>
                <input
                  type="number"
                  aria-label={t('optionsTab.idleLimit')}
                  className="w-20 h-6 px-1 rounded border bg-background"
                  value={seedIdleLimit}
                  onChange={(e) => setSeedIdleLimit(Number(e.target.value))}
                />
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
          <label className="flex items-center gap-2">
            {t('optionsTab.maxPeers')}
            <input
              type="number"
              className="w-20 h-6 px-1 rounded border bg-background"
              value={peerLimit}
              onChange={(e) => setPeerLimit(Number(e.target.value))}
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={sequentialDownload}
              onChange={(e) => setSequentialDownload(e.target.checked)}
            />
            {t('optionsTab.sequentialDownload')}
          </label>
          <label className="flex items-center gap-2">
            {t('optionsTab.labelsLabel')}
            <input
              type="text"
              className="flex-1 h-6 px-1 rounded border bg-background"
              value={labelsText}
              onChange={(e) => setLabelsText(e.target.value)}
              placeholder={t('optionsTab.labelsPlaceholder')}
            />
          </label>
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
