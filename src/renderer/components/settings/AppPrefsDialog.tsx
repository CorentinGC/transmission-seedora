import { useState, useEffect } from 'react';
import { Plus, Trash2, Download, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AppPreferences, PathMapping } from '@shared/types';
import { useUiStore } from '../../stores/ui-store';
import { availableLanguages, getLanguageName } from '../../lib/i18n';
import { Dialog, Button, Input, Select, Checkbox, SectionHeading } from '../ui';

interface Props {
  onClose: () => void;
}

export function AppPrefsDialog({ onClose }: Props) {
  const [prefs, setPrefs] = useState<AppPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const { t, i18n } = useTranslation();
  const setTheme = useUiStore((s) => s.setTheme);
  const setPollingInterval = useUiStore((s) => s.setPollingInterval);
  const setRelativeDates = useUiStore((s) => s.setRelativeDates);
  const setConfirmOnAdd = useUiStore((s) => s.setConfirmOnAdd);

  useEffect(() => {
    window.api.prefsGet().then((res) => {
      if (res.success && res.data) {
        setPrefs(res.data);
      }
      setLoading(false);
    });
  }, []);

  const save = async () => {
    if (!prefs) return;
    await window.api.prefsSet(prefs);

    setTheme(prefs.theme);
    setPollingInterval(prefs.pollingInterval);
    setRelativeDates(prefs.relativeDates);
    setConfirmOnAdd(prefs.confirmOnAdd);

    if (i18n.language !== prefs.language) {
      i18n.changeLanguage(prefs.language);
    }

    useUiStore.getState().setSpeedPresets(prefs.speedPresets ?? null);
    window.api.watcherRestart();
    onClose();
  };

  const updatePref = <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => {
    setPrefs((p) => (p ? { ...p, [key]: value } : p));
  };

  const addMapping = () => {
    if (!prefs) return;
    updatePref('pathMappings', [...prefs.pathMappings, { remote: '', local: '' }]);
  };

  const updateMapping = (index: number, field: keyof PathMapping, value: string) => {
    if (!prefs) return;
    const mappings = [...prefs.pathMappings];
    mappings[index] = { ...mappings[index], [field]: value };
    updatePref('pathMappings', mappings);
  };

  const removeMapping = (index: number) => {
    if (!prefs) return;
    updatePref('pathMappings', prefs.pathMappings.filter((_, i) => i !== index));
  };

  const [backupMsg, setBackupMsg] = useState<string | null>(null);

  const handleExportBackup = async () => {
    const res = await window.api.configExport({ servers: true, preferences: true });
    if (res.success && res.data) {
      const json = JSON.stringify(res.data, null, 2);
      await window.api.dialogSaveFile({ defaultPath: 'seedora-backup.json' }, json);
    }
  };

  const handleImportBackup = async () => {
    const fileRes = await window.api.dialogOpenFile({
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (!fileRes.success || !fileRes.data?.length) return;
    const importRes = await window.api.configImport({ filePath: fileRes.data[0] });
    if (importRes.success) {
      setBackupMsg(t('prefs.importSuccess'));
      const prefsRes = await window.api.prefsGet();
      if (prefsRes.success && prefsRes.data) setPrefs(prefsRes.data);
      setTimeout(() => setBackupMsg(null), 3000);
    }
  };

  const addPreset = () => {
    if (!prefs) return;
    const current = prefs.speedPresets ?? [100, 500, 1000, 2000, 5000];
    updatePref('speedPresets', [...current, 0]);
  };

  const updatePreset = (index: number, value: number) => {
    if (!prefs) return;
    const presets = [...(prefs.speedPresets ?? [100, 500, 1000, 2000, 5000])];
    presets[index] = value;
    updatePref('speedPresets', presets);
  };

  const removePreset = (index: number) => {
    if (!prefs) return;
    const presets = (prefs.speedPresets ?? [100, 500, 1000, 2000, 5000]).filter((_, i) => i !== index);
    updatePref('speedPresets', presets);
  };

  if (loading || !prefs) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-card rounded-lg shadow-lg p-6">{t('app.loading')}</div>
      </div>
    );
  }

  return (
    <Dialog
      title={t('prefs.title')}
      onClose={onClose}
      width="w-[550px]"
      maxHeight="max-h-[80vh]"
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>{t('dialog.cancel')}</Button>
          <Button variant="primary" onClick={save}>{t('dialog.save')}</Button>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        {/* Polling */}
        <div>
          <SectionHeading>{t('prefs.polling')}</SectionHeading>
          <div className="flex items-center gap-2">
            {t('prefs.refreshInterval')}
            <Input inputSize="sm" type="number" min={1000} step={500} className="w-24" value={prefs.pollingInterval} onChange={(e) => updatePref('pollingInterval', Number(e.target.value))} />
          </div>
        </div>

        {/* Theme */}
        <SectionHeading bordered>{t('prefs.appearance')}</SectionHeading>
        <div className="flex items-center gap-2">
          {t('prefs.theme')}
          <Select selectSize="sm" value={prefs.theme} onChange={(e) => updatePref('theme', e.target.value as AppPreferences['theme'])}>
            <option value="system">{t('prefs.themeSystem')}</option>
            <option value="light">{t('prefs.themeLight')}</option>
            <option value="dark">{t('prefs.themeDark')}</option>
          </Select>
        </div>

        {/* Language */}
        <SectionHeading bordered>{t('prefs.language')}</SectionHeading>
        <Select selectSize="sm" value={prefs.language} onChange={(e) => updatePref('language', e.target.value)}>
          {availableLanguages.map((code) => (
            <option key={code} value={code}>{getLanguageName(code)}</option>
          ))}
        </Select>

        {/* Tray */}
        <SectionHeading bordered>{t('prefs.tray')}</SectionHeading>
        <div className="space-y-1">
          <Checkbox label={t('prefs.minimizeToTray')} checked={prefs.minimizeToTray} onChange={(e) => updatePref('minimizeToTray', (e.target as HTMLInputElement).checked)} />
          <Checkbox label={t('prefs.closeToTray')} checked={prefs.closeToTray} onChange={(e) => updatePref('closeToTray', (e.target as HTMLInputElement).checked)} />
          <Checkbox label={t('prefs.showNotifications')} checked={prefs.showNotifications} onChange={(e) => updatePref('showNotifications', (e.target as HTMLInputElement).checked)} />
        </div>

        {/* Display */}
        <SectionHeading bordered>{t('prefs.display')}</SectionHeading>
        <div className="space-y-1">
          <Checkbox label={t('prefs.relativeDates')} checked={prefs.relativeDates} onChange={(e) => updatePref('relativeDates', (e.target as HTMLInputElement).checked)} />
          <Checkbox label={t('prefs.confirmOnAdd')} checked={prefs.confirmOnAdd} onChange={(e) => updatePref('confirmOnAdd', (e.target as HTMLInputElement).checked)} />
        </div>

        {/* Watch Folder */}
        <SectionHeading bordered>{t('prefs.watchFolder')}</SectionHeading>
        <Checkbox label={t('prefs.watchFolderEnabled')} checked={prefs.watchFolderEnabled} onChange={(e) => updatePref('watchFolderEnabled', (e.target as HTMLInputElement).checked)} />
        {prefs.watchFolderEnabled && (
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                inputSize="sm"
                className="flex-1"
                value={prefs.watchFolder ?? ''}
                onChange={(e) => updatePref('watchFolder', e.target.value)}
                placeholder={t('prefs.watchFolderPlaceholder')}
              />
              <Button size="sm" onClick={async () => {
                const res = await window.api.dialogOpenDirectory();
                if (res.success && res.data) updatePref('watchFolder', res.data);
              }}>{t('dialog.browse')}</Button>
            </div>
            <Checkbox label={t('prefs.deleteWatchedTorrent')} checked={prefs.deleteWatchedTorrent} onChange={(e) => updatePref('deleteWatchedTorrent', (e.target as HTMLInputElement).checked)} />
          </div>
        )}

        {/* Path Mappings */}
        <SectionHeading
          bordered
          action={
            <Button size="xs" onClick={addMapping} className="flex items-center gap-1">
              <Plus size={12} /> {t('prefs.pathMappingsAdd')}
            </Button>
          }
        >
          {t('prefs.pathMappings')}
        </SectionHeading>
        <p className="text-xs text-muted-foreground mb-2">{t('prefs.pathMappingsHelp')}</p>
        <div className="space-y-2">
          {prefs.pathMappings.map((mapping, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input inputSize="sm" className="flex-1" value={mapping.remote} onChange={(e) => updateMapping(i, 'remote', e.target.value)} placeholder={t('prefs.remotePath')} />
              <span className="text-muted-foreground">→</span>
              <Input inputSize="sm" className="flex-1" value={mapping.local} onChange={(e) => updateMapping(i, 'local', e.target.value)} placeholder={t('prefs.localPath')} />
              <Button variant="ghost" size="xs" onClick={() => removeMapping(i)} className="text-muted-foreground p-1">
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>

        {/* Speed Presets */}
        <SectionHeading
          bordered
          action={
            <Button size="xs" onClick={addPreset} className="flex items-center gap-1">
              <Plus size={12} /> {t('prefs.addPreset')}
            </Button>
          }
        >
          {t('prefs.speedPresets')}
        </SectionHeading>
        <p className="text-xs text-muted-foreground mb-2">{t('prefs.speedPresetsHelp')}</p>
        <div className="flex flex-wrap gap-2">
          {(prefs.speedPresets ?? [100, 500, 1000, 2000, 5000]).map((val, i) => (
            <div key={i} className="flex items-center gap-1">
              <Input inputSize="sm" type="number" className="w-20 text-right" value={val} onChange={(e) => updatePreset(i, Number(e.target.value))} min={0} />
              <span className="text-xs text-muted-foreground">KB/s</span>
              <Button variant="ghost" size="xs" onClick={() => removePreset(i)} className="text-muted-foreground p-0.5">
                <Trash2 size={12} />
              </Button>
            </div>
          ))}
        </div>

        {/* Backup & Restore */}
        <SectionHeading bordered>{t('prefs.backup')}</SectionHeading>
        <p className="text-xs text-muted-foreground mb-2">{t('prefs.exportBackupHelp')}</p>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleExportBackup} className="flex items-center gap-1.5">
            <Download size={12} /> {t('prefs.exportBackup')}
          </Button>
          <Button size="sm" onClick={handleImportBackup} className="flex items-center gap-1.5">
            <Upload size={12} /> {t('prefs.importBackup')}
          </Button>
        </div>
        {backupMsg && <p className="text-xs text-green-600 mt-2">{backupMsg}</p>}
      </div>
    </Dialog>
  );
}
