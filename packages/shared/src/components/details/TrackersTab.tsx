import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react';
import type { Torrent, TorrentTrackerStats } from '../../types/torrent';
import { useTorrentStore } from '../../stores/torrent-store';
import { Button, Input } from '../ui';
import { useApi } from '../../platform/api-context';
import { fetchTorrentFields, useTorrentFields } from '../../hooks/useTorrentFields';
import { notifyFailure } from '../../stores/notification-store';
import { currentServerEpoch, isServerEpochCurrent } from '../../lib/server-epoch';

interface Props {
  torrent: Torrent;
}

const TRACKER_FIELDS = ['trackerStats', 'trackerList'] as const;

interface TrackerData {
  trackerStats: TorrentTrackerStats[];
  trackerList: string;
}

export function TrackersTab({ torrent }: Props) {
  const { t } = useTranslation();
  const { data, error, refresh } = useTorrentFields<TrackerData>(torrent.id, TRACKER_FIELDS);
  const trackerStats = data?.trackerStats ?? [];
  const [newTracker, setNewTracker] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const setTorrentProps = useTorrentStore((s) => s.setTorrentProps);
  const api = useApi();

  /** Reads the current tracker list; null (after notifying) when the daemon cannot be reached. */
  const getTrackerList = async (): Promise<string | null> => {
    try {
      return (await fetchTorrentFields<{ trackerList: string }>(api, ['trackerList'], torrent.id)).trackerList ?? '';
    } catch (err) {
      notifyFailure('notification.actionFailed', err instanceof Error ? err.message : undefined);
      return null;
    }
  };

  /** Rewrites the tracker list from its current value; true once the change is applied. */
  const updateTrackerList = async (update: (current: string) => string): Promise<boolean> => {
    const epoch = currentServerEpoch();
    const current = await getTrackerList();
    if (current === null) return false;
    // The list was read from a server that is no longer the active one: writing it back
    // to the new server would overwrite that torrent's trackers.
    if (!isServerEpochCurrent(epoch)) return false;
    const ok = await setTorrentProps([torrent.id], { trackerList: update(current) });
    if (ok) await refresh();
    return ok;
  };

  const addTracker = async () => {
    if (!newTracker.trim()) return;
    setLoadingAction('add');
    try {
      const added = await updateTrackerList((current) =>
        current ? `${current}\n\n${newTracker.trim()}` : newTracker.trim(),
      );
      if (added) setNewTracker('');
    } finally {
      setLoadingAction(null);
    }
  };

  const removeTracker = async (announce: string) => {
    setLoadingAction(`remove-${announce}`);
    try {
      await updateTrackerList((current) =>
        current
          .split('\n\n')
          .map((tier) =>
            tier
              .split('\n')
              .filter((l) => l.trim() !== announce)
              .join('\n'),
          )
          .filter((tier) => tier.trim() !== '')
          .join('\n\n'),
      );
    } finally {
      setLoadingAction(null);
    }
  };

  const startEdit = (ts: TorrentTrackerStats) => {
    setEditingId(ts.id);
    setEditValue(ts.announce);
  };

  const saveEdit = async (oldAnnounce: string) => {
    if (!editValue.trim() || editValue.trim() === oldAnnounce) {
      setEditingId(null);
      return;
    }
    setLoadingAction(`save-${oldAnnounce}`);
    try {
      const saved = await updateTrackerList((current) =>
        current
          .split('\n\n')
          .map((tier) =>
            tier
              .split('\n')
              .map((l) => (l.trim() === oldAnnounce ? editValue.trim() : l))
              .join('\n'),
          )
          .join('\n\n'),
      );
      if (saved) setEditingId(null);
    } finally {
      setLoadingAction(null);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  return (
    <div className="text-xs">
      {error && (
        <div role="alert" className="mb-1 text-destructive-text">
          {t('details.loadFailed', { error })}
        </div>
      )}
      {/* Table */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-muted-foreground font-medium border-b">
            <th className="text-left px-1.5 py-1 w-10">{t('trackersTab.tier')}</th>
            <th className="text-left px-1.5 py-1">{t('trackersTab.announceUrl')}</th>
            <th className="text-right px-1.5 py-1 w-16">{t('trackersTab.seeds')}</th>
            <th className="text-right px-1.5 py-1 w-16">{t('trackersTab.leechers')}</th>
            <th className="text-left px-1.5 py-1 w-24">{t('trackersTab.status')}</th>
            <th className="w-14" />
          </tr>
        </thead>
        <tbody>
          {trackerStats.map((ts) => (
            <tr key={ts.id} className="hover:bg-accent group">
              <td className="px-1.5 py-1 text-muted-foreground">{ts.tier}</td>
              <td className="px-1.5 py-1">
                {editingId === ts.id ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="text"
                      inputSize="xs"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      aria-label={t('trackersTab.announceUrl')}
                      className="flex-1 px-1.5"
                      // Entering edit mode on a row is an explicit user action; focus belongs in the field.
                      // eslint-disable-next-line jsx-a11y/no-autofocus
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(ts.announce);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                    />
                    <Button
                      size="xs"
                      variant="primary"
                      onClick={() => saveEdit(ts.announce)}
                      disabled={loadingAction === `save-${ts.announce}`}
                      aria-label={t('trackersTab.save')}
                      title={t('trackersTab.save')}
                    >
                      <Check size={12} aria-hidden="true" />
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={cancelEdit}
                      aria-label={t('trackersTab.cancel')}
                      title={t('trackersTab.cancel')}
                    >
                      <X size={12} aria-hidden="true" />
                    </Button>
                  </div>
                ) : (
                  <span
                    className="block truncate cursor-pointer hover:underline"
                    onDoubleClick={() => startEdit(ts)}
                    title={ts.announce}
                  >
                    {ts.announce}
                  </span>
                )}
              </td>
              <td className="px-1.5 py-1 text-right">{ts.seederCount >= 0 ? ts.seederCount : '-'}</td>
              <td className="px-1.5 py-1 text-right">{ts.leecherCount >= 0 ? ts.leecherCount : '-'}</td>
              <td
                className="px-1.5 py-1 max-w-24 truncate"
                title={ts.lastAnnounceSucceeded ? t('trackersTab.ok') : ts.lastAnnounceResult || ''}
              >
                {ts.lastAnnounceSucceeded ? (
                  <span className="text-success">{t('trackersTab.ok')}</span>
                ) : (
                  <span className="text-muted-foreground">{ts.lastAnnounceResult || t('trackersTab.na')}</span>
                )}
              </td>
              <td className="px-1.5 py-1">
                {editingId !== ts.id && (
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => startEdit(ts)}
                      title={t('trackersTab.edit')}
                      aria-label={`${t('trackersTab.edit')} ${ts.announce}`}
                      className="p-1 h-5 w-5"
                    >
                      <Pencil size={12} aria-hidden="true" />
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => removeTracker(ts.announce)}
                      disabled={loadingAction === `remove-${ts.announce}`}
                      title={t('trackersTab.remove')}
                      aria-label={`${t('trackersTab.remove')} ${ts.announce}`}
                      className="p-1 h-5 w-5 text-destructive-text hover:text-destructive-text"
                    >
                      <Trash2 size={12} aria-hidden="true" />
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Add tracker */}
      <div className="flex items-center gap-2 mt-2 pt-2 border-t px-1.5">
        <Input
          type="text"
          inputSize="sm"
          placeholder={t('trackersTab.addPlaceholder')}
          aria-label={t('trackersTab.addPlaceholder')}
          value={newTracker}
          onChange={(e) => setNewTracker(e.target.value)}
          className="flex-1 text-xs"
          onKeyDown={(e) => e.key === 'Enter' && addTracker()}
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={addTracker}
          disabled={!newTracker.trim() || loadingAction === 'add'}
          className="shrink-0 whitespace-nowrap"
        >
          <Plus size={14} className="mr-1" aria-hidden="true" />
          {t('trackersTab.add')}
        </Button>
      </div>
    </div>
  );
}
