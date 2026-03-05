import { useTranslation } from 'react-i18next';
import { X, AlertTriangle } from 'lucide-react';
import { useTorrentStore } from '../../stores/torrent-store';

interface Props {
  ids: number[];
  onClose: () => void;
}

export function RemoveTorrentDialog({ ids, onClose }: Props) {
  const { t } = useTranslation();
  const removeTorrents = useTorrentStore((s) => s.removeTorrents);
  const torrents = useTorrentStore((s) => s.torrents);

  const names = ids.map((id) => torrents.get(id)?.name ?? `#${id}`);

  const handleRemove = async (deleteData: boolean) => {
    await removeTorrents(ids, deleteData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border rounded-lg shadow-xl w-fit min-w-[420px]">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle size={18} className="text-destructive" />
            {ids.length > 1 ? t('dialog.removeTorrents') : t('dialog.removeTorrent')}
          </h2>
          <button onClick={onClose} className="hover:bg-accent rounded p-1">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-sm">
            {t('dialog.removeTorrentConfirm', { count: ids.length })}
          </p>
          <div className="max-h-32 overflow-auto text-xs text-muted-foreground space-y-0.5">
            {names.map((name, i) => (
              <div key={i} className="truncate">{name}</div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t whitespace-nowrap">
          <button className="h-8 px-3 text-sm rounded border hover:bg-accent" onClick={onClose}>
            {t('dialog.cancel')}
          </button>
          <button
            className="h-8 px-3 text-sm rounded border hover:bg-accent"
            onClick={() => handleRemove(false)}
          >
            {t('dialog.removeTorrentBtn')}
          </button>
          <button
            className="h-8 px-3 text-sm rounded bg-destructive text-destructive-foreground hover:opacity-90"
            onClick={() => handleRemove(true)}
          >
            {t('dialog.removeWithData')}
          </button>
        </div>
      </div>
    </div>
  );
}
