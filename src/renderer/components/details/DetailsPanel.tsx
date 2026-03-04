import { useState } from 'react';
import type { Torrent } from '../../types/torrent';
import { GeneralTab } from './GeneralTab';
import { FilesTab } from './FilesTab';
import { PeersTab } from './PeersTab';
import { TrackersTab } from './TrackersTab';
import { OptionsTab } from './OptionsTab';

interface Props {
  torrent: Torrent;
}

const TABS = ['General', 'Files', 'Peers', 'Trackers', 'Options'] as const;
type Tab = (typeof TABS)[number];

export function DetailsPanel({ torrent }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('General');

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="flex border-b select-none">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`px-3 py-1.5 text-xs font-medium ${
              activeTab === tab
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
        <div className="flex-1" />
        <div className="px-3 py-1.5 text-xs text-muted-foreground truncate max-w-xs">
          {torrent.name}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-3 text-sm">
        {activeTab === 'General' && <GeneralTab torrent={torrent} />}
        {activeTab === 'Files' && <FilesTab torrent={torrent} />}
        {activeTab === 'Peers' && <PeersTab torrent={torrent} />}
        {activeTab === 'Trackers' && <TrackersTab torrent={torrent} />}
        {activeTab === 'Options' && <OptionsTab torrent={torrent} />}
      </div>
    </div>
  );
}
