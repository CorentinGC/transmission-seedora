import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTorrentStore } from '../../stores/torrent-store';
import { useApi } from '../../platform/api-context';
import { Dialog, Button, Input, Field, Checkbox } from '../ui';
import { guardedCall } from '../../lib/guarded-call';

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
  const api = useApi();

  const handleBrowse = async () => {
    if (!api.dialogOpenDirectory) return;
    const openDirectory = api.dialogOpenDirectory.bind(api);
    const res = await guardedCall(() => openDirectory(), 'notification.pickerFailed');
    if (res?.data) setLocation(res.data);
  };

  const handleApply = async () => {
    if (location.trim()) {
      if (await moveTorrents(ids, location.trim(), move)) onClose();
    }
  };

  return (
    <Dialog
      title={t('dialog.setLocation')}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button onClick={onClose}>{t('dialog.cancel')}</Button>
          <Button variant="primary" onClick={handleApply} disabled={!location.trim()}>
            {t('dialog.apply')}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Field label={t('dialog.newLocation')}>
          <div className="flex gap-2">
            <Input
              className="min-w-0 flex-1"
              type="text"
              data-autofocus
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
            <Button onClick={handleBrowse}>{t('dialog.browse')}</Button>
          </div>
        </Field>
        <Checkbox
          label={t('dialog.moveData')}
          checked={move}
          onChange={(e) => setMove(e.target.checked)}
          className="text-sm"
        />
      </div>
    </Dialog>
  );
}
