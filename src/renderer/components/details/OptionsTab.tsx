import { useState } from 'react';
import type { Torrent } from '../../types/torrent';
import { useTorrentStore } from '../../stores/torrent-store';
import { formatBytes } from '../../lib/format';

interface Props {
  torrent: Torrent;
}

export function OptionsTab({ torrent: t }: Props) {
  const setTorrentProps = useTorrentStore((s) => s.setTorrentProps);

  const [downloadLimit, setDownloadLimit] = useState(t.downloadLimit);
  const [downloadLimited, setDownloadLimited] = useState(t.downloadLimited);
  const [uploadLimit, setUploadLimit] = useState(t.uploadLimit);
  const [uploadLimited, setUploadLimited] = useState(t.uploadLimited);
  const [seedRatioLimit, setSeedRatioLimit] = useState(t.seedRatioLimit);
  const [seedRatioMode, setSeedRatioMode] = useState(t.seedRatioMode);
  const [seedIdleLimit, setSeedIdleLimit] = useState(t.seedIdleLimit);
  const [seedIdleMode, setSeedIdleMode] = useState(t.seedIdleMode);
  const [peerLimit, setPeerLimit] = useState(t.peerLimit);
  const [bandwidthPriority, setBandwidthPriority] = useState(t.bandwidthPriority);
  const [honorsSessionLimits, setHonorsSessionLimits] = useState(t.honorsSessionLimits);
  const [sequentialDownload, setSequentialDownload] = useState(t.sequentialDownload);
  const [labelsText, setLabelsText] = useState(t.labels?.join(', ') ?? '');

  const apply = () => {
    setTorrentProps([t.id], {
      downloadLimit,
      downloadLimited,
      uploadLimit,
      uploadLimited,
      seedRatioLimit,
      seedRatioMode,
      seedIdleLimit,
      seedIdleMode,
      peerLimit,
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
        <h4 className="font-medium mb-1">Bandwidth</h4>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={downloadLimited} onChange={(e) => setDownloadLimited(e.target.checked)} />
            Download limit (KB/s):
            <input type="number" className="w-20 h-6 px-1 rounded border bg-background" value={downloadLimit} onChange={(e) => setDownloadLimit(Number(e.target.value))} disabled={!downloadLimited} />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={uploadLimited} onChange={(e) => setUploadLimited(e.target.checked)} />
            Upload limit (KB/s):
            <input type="number" className="w-20 h-6 px-1 rounded border bg-background" value={uploadLimit} onChange={(e) => setUploadLimit(Number(e.target.value))} disabled={!uploadLimited} />
          </label>
        </div>
        <label className="flex items-center gap-2 mt-1">
          <input type="checkbox" checked={honorsSessionLimits} onChange={(e) => setHonorsSessionLimits(e.target.checked)} />
          Honor session limits
        </label>
        <div className="flex items-center gap-2 mt-1">
          Priority:
          <select className="h-6 px-1 rounded border bg-background" value={bandwidthPriority} onChange={(e) => setBandwidthPriority(Number(e.target.value))}>
            <option value={-1}>Low</option>
            <option value={0}>Normal</option>
            <option value={1}>High</option>
          </select>
        </div>
      </div>

      {/* Seeding */}
      <div>
        <h4 className="font-medium mb-1">Seeding</h4>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            Ratio mode:
            <select className="h-6 px-1 rounded border bg-background" value={seedRatioMode} onChange={(e) => setSeedRatioMode(Number(e.target.value))}>
              <option value={0}>Global</option>
              <option value={1}>Custom</option>
              <option value={2}>Unlimited</option>
            </select>
            {seedRatioMode === 1 && (
              <input type="number" step="0.1" className="w-20 h-6 px-1 rounded border bg-background" value={seedRatioLimit} onChange={(e) => setSeedRatioLimit(Number(e.target.value))} />
            )}
          </div>
          <div className="flex items-center gap-2">
            Idle mode:
            <select className="h-6 px-1 rounded border bg-background" value={seedIdleMode} onChange={(e) => setSeedIdleMode(Number(e.target.value))}>
              <option value={0}>Global</option>
              <option value={1}>Custom</option>
              <option value={2}>Unlimited</option>
            </select>
            {seedIdleMode === 1 && (
              <>
                <input type="number" className="w-20 h-6 px-1 rounded border bg-background" value={seedIdleLimit} onChange={(e) => setSeedIdleLimit(Number(e.target.value))} />
                <span className="text-muted-foreground">minutes</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Other */}
      <div>
        <h4 className="font-medium mb-1">Other</h4>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            Max peers:
            <input type="number" className="w-20 h-6 px-1 rounded border bg-background" value={peerLimit} onChange={(e) => setPeerLimit(Number(e.target.value))} />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={sequentialDownload} onChange={(e) => setSequentialDownload(e.target.checked)} />
            Sequential download
          </label>
          <div className="flex items-center gap-2">
            Labels:
            <input type="text" className="flex-1 h-6 px-1 rounded border bg-background" value={labelsText} onChange={(e) => setLabelsText(e.target.value)} placeholder="label1, label2" />
          </div>
        </div>
      </div>

      <div className="pt-2 border-t">
        <button
          className="h-7 px-4 text-xs rounded bg-primary text-primary-foreground hover:opacity-90"
          onClick={apply}
        >
          Apply
        </button>
      </div>
    </div>
  );
}
