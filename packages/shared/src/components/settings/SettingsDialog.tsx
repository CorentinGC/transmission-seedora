import { useState, useEffect, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '../../stores/session-store';
import { Dialog, Tabs } from '../ui';
import { SpeedTab } from './SpeedTab';
import { NetworkTab } from './NetworkTab';
import { DownloadTab } from './DownloadTab';
import { QueueTab } from './QueueTab';

interface Props {
  onClose: () => void;
}

const TABS = [
  { id: 'Speed', labelKey: 'settings.speed' },
  { id: 'Network', labelKey: 'settings.network' },
  { id: 'Download', labelKey: 'settings.download' },
  { id: 'Queue', labelKey: 'settings.queue' },
] as const;
type Tab = (typeof TABS)[number]['id'];

export function SettingsDialog({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('Speed');
  const { t } = useTranslation();
  const settings = useSessionStore((s) => s.settings);
  const fetchSettings = useSessionStore((s) => s.fetchSettings);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const idBase = useId();

  if (!settings) {
    return (
      <Dialog title={t('settings.title')} onClose={onClose}>
        <p className="text-sm text-muted-foreground">{t('settings.loading')}</p>
      </Dialog>
    );
  }

  return (
    <Dialog title={t('settings.title')} onClose={onClose} width="w-[600px]" maxHeight="max-h-[80vh]">
      <div className="-mx-4 -mt-4 mb-4">
        <Tabs
          id={idBase}
          label={t('settings.title')}
          tabs={TABS.map((tab) => ({ id: tab.id, label: t(tab.labelKey) }))}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as Tab)}
        />
      </div>
      <div role="tabpanel" id={`${idBase}-panel`} aria-labelledby={`${idBase}-tab-${activeTab}`}>
        {activeTab === 'Speed' && <SpeedTab settings={settings} />}
        {activeTab === 'Network' && <NetworkTab settings={settings} />}
        {activeTab === 'Download' && <DownloadTab settings={settings} />}
        {activeTab === 'Queue' && <QueueTab settings={settings} />}
      </div>
    </Dialog>
  );
}
