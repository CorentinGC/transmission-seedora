import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '../../stores/session-store';
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

  if (!settings) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-card border rounded-lg shadow-xl p-8">
          {t('settings.loading')}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{t('settings.title')}</h2>
          <button onClick={onClose} className="hover:bg-accent rounded p-1">
            <X size={16} />
          </button>
        </div>

        <div className="flex border-b">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === tab.id
                  ? 'border-b-2 border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-4">
          {activeTab === 'Speed' && <SpeedTab settings={settings} />}
          {activeTab === 'Network' && <NetworkTab settings={settings} />}
          {activeTab === 'Download' && <DownloadTab settings={settings} />}
          {activeTab === 'Queue' && <QueueTab settings={settings} />}
        </div>
      </div>
    </div>
  );
}
