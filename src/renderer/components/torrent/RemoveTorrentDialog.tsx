import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { useTorrentStore } from '../../stores/torrent-store';
import { Dialog, Button } from '../ui';

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
    <Dialog
      title={
        <span className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-destructive" />
          {ids.length > 1 ? t('dialog.removeTorrents') : t('dialog.removeTorrent')}
        </span>
      }
      onClose={onClose}
      width="w-fit min-w-[420px]"
      footer={
        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
          <Button onClick={onClose}>{t('dialog.cancel')}</Button>
          <Button onClick={() => handleRemove(false)}>{t('dialog.removeTorrentBtn')}</Button>
          <Button variant="destructive" onClick={() => handleRemove(true)}>{t('dialog.removeWithData')}</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm">
          {t('dialog.removeTorrentConfirm', { count: ids.length })}
        </p>
        <div className="max-h-32 overflow-auto text-xs text-muted-foreground space-y-0.5">
          {names.map((name, i) => (
            <div key={i} className="truncate">{name}</div>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
