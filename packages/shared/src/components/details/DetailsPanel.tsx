import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Torrent } from '../../types/torrent';
import { Tabs } from '../ui';
import { GeneralTab } from './GeneralTab';
import { FilesTab } from './FilesTab';
import { PeersTab } from './PeersTab';
import { TrackersTab } from './TrackersTab';
import { OptionsTab } from './OptionsTab';

interface Props {
  torrent: Torrent;
}

const TABS = [
  { id: 'General', labelKey: 'details.general' },
  { id: 'Files', labelKey: 'details.files' },
  { id: 'Peers', labelKey: 'details.peers' },
  { id: 'Trackers', labelKey: 'details.trackers' },
  { id: 'Options', labelKey: 'details.options' },
] as const;
type Tab = (typeof TABS)[number]['id'];

export function DetailsPanel({ torrent }: Props) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('General');

  const idBase = useId();

  return (
    <div className="flex flex-col h-full bg-card">
      <Tabs
        id={idBase}
        size="sm"
        label={t('toolbar.detailsPanel')}
        tabs={TABS.map((tab) => ({ id: tab.id, label: t(tab.labelKey) }))}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as Tab)}
      >
        <div className="flex-1" />
        <div className="px-3 py-1.5 text-xs text-muted-foreground truncate max-w-xs self-center" title={torrent.name}>
          {torrent.name}
        </div>
      </Tabs>
      <div
        role="tabpanel"
        id={`${idBase}-panel`}
        aria-labelledby={`${idBase}-tab-${activeTab}`}
        className="flex-1 overflow-auto p-3 text-sm"
      >
        {activeTab === 'General' && <GeneralTab torrent={torrent} />}
        {activeTab === 'Files' && <FilesTab torrent={torrent} />}
        {activeTab === 'Peers' && <PeersTab torrent={torrent} />}
        {activeTab === 'Trackers' && <TrackersTab torrent={torrent} />}
        {activeTab === 'Options' && <OptionsTab torrent={torrent} />}
      </div>
    </div>
  );
}
