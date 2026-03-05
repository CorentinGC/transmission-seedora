import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTorrentStore } from '../../stores/torrent-store';
import { Dialog, Button, Input, Field } from '../ui';
import { useApi } from '../../platform/api-context';

interface Props {
  torrentId: number;
  currentName: string;
  onClose: () => void;
}

export function RenameTorrentDialog({ torrentId, currentName, onClose }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState(currentName);
  const api = useApi();

  const handleRename = async () => {
    if (name.trim() && name !== currentName) {
      await api.rpcTorrentRenamePath([torrentId], currentName, name.trim());
      useTorrentStore.getState().fetchRecentlyActive();
      onClose();
    }
  };

  return (
    <Dialog
      title={t('dialog.renameTorrent')}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button onClick={onClose}>{t('dialog.cancel')}</Button>
          <Button variant="primary" onClick={handleRename} disabled={!name.trim() || name === currentName}>
            {t('dialog.renameTorrent')}
          </Button>
        </div>
      }
    >
      <Field label={t('torrent.name')}>
        <Input
          className="w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleRename()}
        />
      </Field>
    </Dialog>
  );
}
