import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  List,
  ArrowDown,
  ArrowUp,
  Activity,
  Moon,
  Square,
  AlertCircle,
  Clock,
  CheckCircle2,
  Tag,
  Globe,
  FolderOpen,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { useTorrentStore } from '../../stores/torrent-store';
import { matchesStatusFilter, type StatusFilter } from '../../lib/constants';
import type { Torrent } from '../../types/torrent';

interface Props {
  torrents: Torrent[];
}

const STATUS_ITEMS: { filter: StatusFilter; labelKey: string; icon: React.ReactNode }[] = [
  { filter: 'all', labelKey: 'filter.all', icon: <List size={14} /> },
  { filter: 'downloading', labelKey: 'filter.downloading', icon: <ArrowDown size={14} /> },
  { filter: 'seeding', labelKey: 'filter.seeding', icon: <ArrowUp size={14} /> },
  { filter: 'completed', labelKey: 'filter.completed', icon: <CheckCircle2 size={14} /> },
  { filter: 'active', labelKey: 'filter.active', icon: <Activity size={14} /> },
  { filter: 'inactive', labelKey: 'filter.inactive', icon: <Moon size={14} /> },
  { filter: 'stopped', labelKey: 'filter.stopped', icon: <Square size={14} /> },
  { filter: 'error', labelKey: 'filter.error', icon: <AlertCircle size={14} /> },
  { filter: 'waiting', labelKey: 'filter.waiting', icon: <Clock size={14} /> },
];

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-t py-1">
      <button
        className="w-full flex items-center gap-1 px-3 py-1 text-xs font-medium text-muted-foreground uppercase hover:text-foreground min-w-0"
        onClick={() => setOpen(!open)}
      >
        <span className="flex-shrink-0">{open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
        <span className="truncate">{title}</span>
      </button>
      {open && children}
    </div>
  );
}

export function FilterSidebar({ torrents }: Props) {
  const { t } = useTranslation();
  const statusFilter = useTorrentStore((s) => s.statusFilter);
  const setStatusFilter = useTorrentStore((s) => s.setStatusFilter);
  const labelFilter = useTorrentStore((s) => s.labelFilter);
  const setLabelFilter = useTorrentStore((s) => s.setLabelFilter);
  const trackerFilter = useTorrentStore((s) => s.trackerFilter);
  const setTrackerFilter = useTorrentStore((s) => s.setTrackerFilter);
  const folderFilter = useTorrentStore((s) => s.folderFilter);
  const setFolderFilter = useTorrentStore((s) => s.setFolderFilter);

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: torrents.length,
      downloading: 0, seeding: 0, completed: 0,
      active: 0, inactive: 0, stopped: 0, error: 0, waiting: 0,
    };
    for (const t of torrents) {
      for (const f of Object.keys(counts) as StatusFilter[]) {
        if (f !== 'all' && matchesStatusFilter(t.status, t.error, t.isFinished, t.rateDownload, t.rateUpload, f)) {
          counts[f]++;
        }
      }
    }
    return counts;
  }, [torrents]);

  const labels = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of torrents) {
      if (t.labels) {
        for (const l of t.labels) {
          map.set(l, (map.get(l) ?? 0) + 1);
        }
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [torrents]);

  const trackers = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of torrents) {
      if (t.trackerStats) {
        const sites = new Set(t.trackerStats.map((ts) => ts.sitename || ts.host));
        for (const site of sites) {
          map.set(site, (map.get(site) ?? 0) + 1);
        }
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [torrents]);

  const folders = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of torrents) {
      if (t.downloadDir) {
        map.set(t.downloadDir, (map.get(t.downloadDir) ?? 0) + 1);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [torrents]);

  return (
    <div className="w-full h-full overflow-y-auto overflow-x-hidden bg-card select-none text-sm">
      {/* Status filters */}
      <div className="py-1">
        {STATUS_ITEMS.map(({ filter, labelKey, icon }) => (
          <button
            key={filter}
            className={`w-full flex items-center gap-2 px-3 py-1 hover:bg-accent min-w-0 ${
              statusFilter === filter && !labelFilter && !trackerFilter && !folderFilter ? 'bg-accent font-medium' : ''
            }`}
            onClick={() => {
              setStatusFilter(filter);
              setLabelFilter(null);
              setTrackerFilter(null);
              setFolderFilter(null);
            }}
          >
            <span className="flex-shrink-0">{icon}</span>
            <span className="flex-1 text-left truncate min-w-0">{t(labelKey)}</span>
            <span className="text-xs text-muted-foreground flex-shrink-0">{statusCounts[filter]}</span>
          </button>
        ))}
      </div>

      {/* Labels */}
      {labels.length > 0 && (
        <CollapsibleSection title={t('filter.labels')}>
          {labels.map(([label, count]) => (
            <button
              key={label}
              className={`w-full flex items-center gap-2 px-3 py-1 hover:bg-accent min-w-0 ${
                labelFilter === label ? 'bg-accent font-medium' : ''
              }`}
              onClick={() => {
                setLabelFilter(labelFilter === label ? null : label);
                setStatusFilter('all');
                setTrackerFilter(null);
                setFolderFilter(null);
              }}
            >
              <Tag size={14} className="flex-shrink-0" />
              <span className="flex-1 text-left truncate min-w-0">{label}</span>
              <span className="text-xs text-muted-foreground flex-shrink-0">{count}</span>
            </button>
          ))}
        </CollapsibleSection>
      )}

      {/* Folders (before Trackers) */}
      {folders.length > 0 && (
        <CollapsibleSection title={t('filter.folders')}>
          {folders.map(([folder, count]) => (
            <button
              key={folder}
              className={`w-full flex items-center gap-2 px-3 py-1 hover:bg-accent min-w-0 ${
                folderFilter === folder ? 'bg-accent font-medium' : ''
              }`}
              onClick={() => {
                setFolderFilter(folderFilter === folder ? null : folder);
                setStatusFilter('all');
                setLabelFilter(null);
                setTrackerFilter(null);
              }}
            >
              <FolderOpen size={14} className="flex-shrink-0" />
              <span className="flex-1 text-left truncate min-w-0">{folder.split('/').pop()}</span>
              <span className="text-xs text-muted-foreground flex-shrink-0">{count}</span>
            </button>
          ))}
        </CollapsibleSection>
      )}

      {/* Trackers (collapsed by default) */}
      {trackers.length > 0 && (
        <CollapsibleSection title={t('filter.trackers')} defaultOpen={false}>
          {trackers.map(([tracker, count]) => (
            <button
              key={tracker}
              className={`w-full flex items-center gap-2 px-3 py-1 hover:bg-accent min-w-0 ${
                trackerFilter === tracker ? 'bg-accent font-medium' : ''
              }`}
              onClick={() => {
                setTrackerFilter(trackerFilter === tracker ? null : tracker);
                setStatusFilter('all');
                setLabelFilter(null);
                setFolderFilter(null);
              }}
            >
              <Globe size={14} className="flex-shrink-0" />
              <span className="flex-1 text-left truncate min-w-0">{tracker}</span>
              <span className="text-xs text-muted-foreground flex-shrink-0">{count}</span>
            </button>
          ))}
        </CollapsibleSection>
      )}
    </div>
  );
}
