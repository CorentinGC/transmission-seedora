import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '../../stores/session-store';
import type { SessionSettings } from '../../types/session';

interface Props {
  settings: SessionSettings;
}

export function DownloadTab({ settings: s }: Props) {
  const { t } = useTranslation();
  const updateSettings = useSessionStore((st) => st.updateSettings);

  const [downloadDir, setDownloadDir] = useState(s.downloadDir);
  const [incompleteDirEnabled, setIncompleteDirEnabled] = useState(s.incompleteDirEnabled);
  const [incompleteDir, setIncompleteDir] = useState(s.incompleteDir);
  const [renamePartialFiles, setRenamePartialFiles] = useState(s.renamePartialFiles);
  const [startAddedTorrents, setStartAddedTorrents] = useState(s.startAddedTorrents);
  const [trashOriginalTorrentFiles, setTrashOriginalTorrentFiles] = useState(s.trashOriginalTorrentFiles);
  const [scriptTorrentDoneEnabled, setScriptTorrentDoneEnabled] = useState(s.scriptTorrentDoneEnabled);
  const [scriptTorrentDoneFilename, setScriptTorrentDoneFilename] = useState(s.scriptTorrentDoneFilename);
  const [scriptTorrentAddedEnabled, setScriptTorrentAddedEnabled] = useState(s.scriptTorrentAddedEnabled);
  const [scriptTorrentAddedFilename, setScriptTorrentAddedFilename] = useState(s.scriptTorrentAddedFilename);

  const apply = () => {
    updateSettings({
      downloadDir,
      incompleteDirEnabled,
      incompleteDir,
      renamePartialFiles,
      startAddedTorrents,
      trashOriginalTorrentFiles,
      scriptTorrentDoneEnabled,
      scriptTorrentDoneFilename,
      scriptTorrentAddedEnabled,
      scriptTorrentAddedFilename,
    });
  };

  return (
    <div className="space-y-4 text-sm">
      <div>
        <h3 className="font-medium mb-2">{t('downloadTab.downloadDirectory')}</h3>
        <input type="text" className="w-full h-7 px-2 rounded border bg-background" value={downloadDir} onChange={(e) => setDownloadDir(e.target.value)} />
      </div>

      <div className="border-t pt-4">
        <h3 className="font-medium mb-2">{t('downloadTab.incompleteDirectory')}</h3>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={incompleteDirEnabled} onChange={(e) => setIncompleteDirEnabled(e.target.checked)} />
          {t('downloadTab.useIncompleteDir')}
        </label>
        {incompleteDirEnabled && (
          <input type="text" className="w-full h-7 px-2 mt-1 rounded border bg-background" value={incompleteDir} onChange={(e) => setIncompleteDir(e.target.value)} />
        )}
      </div>

      <div className="border-t pt-4 space-y-1">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={renamePartialFiles} onChange={(e) => setRenamePartialFiles(e.target.checked)} />
          {t('downloadTab.appendPart')}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={startAddedTorrents} onChange={(e) => setStartAddedTorrents(e.target.checked)} />
          {t('downloadTab.startAutomatically')}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={trashOriginalTorrentFiles} onChange={(e) => setTrashOriginalTorrentFiles(e.target.checked)} />
          {t('downloadTab.deleteTorrentFile')}
        </label>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-medium mb-2">{t('downloadTab.scripts')}</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={scriptTorrentAddedEnabled} onChange={(e) => setScriptTorrentAddedEnabled(e.target.checked)} />
            {t('downloadTab.scriptOnAdded')}
          </label>
          {scriptTorrentAddedEnabled && (
            <input type="text" className="w-full h-7 px-2 rounded border bg-background" value={scriptTorrentAddedFilename} onChange={(e) => setScriptTorrentAddedFilename(e.target.value)} placeholder={t('downloadTab.scriptPlaceholder')} />
          )}
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={scriptTorrentDoneEnabled} onChange={(e) => setScriptTorrentDoneEnabled(e.target.checked)} />
            {t('downloadTab.scriptOnCompleted')}
          </label>
          {scriptTorrentDoneEnabled && (
            <input type="text" className="w-full h-7 px-2 rounded border bg-background" value={scriptTorrentDoneFilename} onChange={(e) => setScriptTorrentDoneFilename(e.target.value)} placeholder={t('downloadTab.scriptPlaceholder')} />
          )}
        </div>
      </div>

      <div className="border-t pt-4">
        <button className="h-8 px-4 text-sm rounded bg-primary text-primary-foreground hover:opacity-90" onClick={apply}>{t('dialog.apply')}</button>
      </div>
    </div>
  );
}
