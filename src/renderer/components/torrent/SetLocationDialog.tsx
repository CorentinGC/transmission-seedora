import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useTorrentStore } from '../../stores/torrent-store';

interface Props {
  ids: number[];
  currentLocation?: string;
  onClose: () => void;
}

export function SetLocationDialog({ ids, currentLocation, onClose }: Props) {
  const { t } = useTranslation();
  const [location, setLocation] = useState(currentLocation ?? '');
  const [move, setMove] = useState(true);
  const moveTorrents = useTorrentStore((s) => s.moveTorrents);

  const handleBrowse = async () => {
    const res = await window.api.dialogOpenDirectory();
    if (res.success && res.data) setLocation(res.data);
  };

  const handleApply = async () => {
    if (location.trim()) {
      await moveTorrents(ids, location.trim(), move);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border rounded-lg shadow-xl w-[420px]">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{t('dialog.setLocation')}</h2>
          <button onClick={onClose} className="hover:bg-accent rounded p-1"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">{t('dialog.newLocation')}</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 h-8 px-2 text-sm rounded border bg-background"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
              <button className="h-8 px-3 text-sm rounded border hover:bg-accent" onClick={handleBrowse}>{t('dialog.browse')}</button>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={move} onChange={(e) => setMove(e.target.checked)} />
            {t('dialog.moveData')}
          </label>
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t">
          <button className="h-8 px-3 text-sm rounded border hover:bg-accent" onClick={onClose}>{t('dialog.cancel')}</button>
          <button className="h-8 px-4 text-sm rounded bg-primary text-primary-foreground hover:opacity-90" onClick={handleApply} disabled={!location.trim()}>
            {t('dialog.apply')}
          </button>
        </div>
      </div>
    </div>
  );
}
