import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Download, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AppPreferences, PathMapping } from '@shared/types';
import { useUiStore } from '../../stores/ui-store';
import { availableLanguages, getLanguageName } from '../../lib/i18n';

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

    // Apply all preferences immediately
    setTheme(prefs.theme);
    setPollingInterval(prefs.pollingInterval);
    setRelativeDates(prefs.relativeDates);
    setConfirmOnAdd(prefs.confirmOnAdd);

    if (i18n.language !== prefs.language) {
      i18n.changeLanguage(prefs.language);
    }

    // Update speed presets in UI store
    useUiStore.getState().setSpeedPresets(prefs.speedPresets ?? null);

    // Restart watcher if watch folder settings changed
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
      await window.api.dialogSaveFile({ defaultPath: 'transmission-remote-backup.json' }, json);
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
      // Reload prefs
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card rounded-lg shadow-lg w-[550px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold">{t('prefs.title')}</h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded"><X size={16} /></button>
        </div>

        <div className="overflow-y-auto p-4 space-y-4 text-sm">
          {/* Polling */}
          <div>
            <h3 className="font-medium mb-2">{t('prefs.polling')}</h3>
            <div className="flex items-center gap-2">
              {t('prefs.refreshInterval')}
              <input
                type="number"
                min={1000}
                step={500}
                className="w-24 h-7 px-2 rounded border bg-background"
                value={prefs.pollingInterval}
                onChange={(e) => updatePref('pollingInterval', Number(e.target.value))}
              />
            </div>
          </div>

          {/* Theme */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-2">{t('prefs.appearance')}</h3>
            <div className="flex items-center gap-2">
              {t('prefs.theme')}
              <select
                className="h-7 px-2 rounded border bg-background"
                value={prefs.theme}
                onChange={(e) => updatePref('theme', e.target.value as AppPreferences['theme'])}
              >
                <option value="system">{t('prefs.themeSystem')}</option>
                <option value="light">{t('prefs.themeLight')}</option>
                <option value="dark">{t('prefs.themeDark')}</option>
              </select>
            </div>
          </div>

          {/* Language */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-2">{t('prefs.language')}</h3>
            <select
              className="h-7 px-2 rounded border bg-background"
              value={prefs.language}
              onChange={(e) => updatePref('language', e.target.value)}
            >
              {availableLanguages.map((code) => (
                <option key={code} value={code}>{getLanguageName(code)}</option>
              ))}
            </select>
          </div>

          {/* Tray */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-2">{t('prefs.tray')}</h3>
            <div className="space-y-1">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={prefs.minimizeToTray} onChange={(e) => updatePref('minimizeToTray', e.target.checked)} />
                {t('prefs.minimizeToTray')}
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={prefs.closeToTray} onChange={(e) => updatePref('closeToTray', e.target.checked)} />
                {t('prefs.closeToTray')}
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={prefs.showNotifications} onChange={(e) => updatePref('showNotifications', e.target.checked)} />
                {t('prefs.showNotifications')}
              </label>
            </div>
          </div>

          {/* Display */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-2">{t('prefs.display')}</h3>
            <div className="space-y-1">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={prefs.relativeDates} onChange={(e) => updatePref('relativeDates', e.target.checked)} />
                {t('prefs.relativeDates')}
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={prefs.confirmOnAdd} onChange={(e) => updatePref('confirmOnAdd', e.target.checked)} />
                {t('prefs.confirmOnAdd')}
              </label>
            </div>
          </div>

          {/* Watch Folder */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-2">{t('prefs.watchFolder')}</h3>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={prefs.watchFolderEnabled} onChange={(e) => updatePref('watchFolderEnabled', e.target.checked)} />
              {t('prefs.watchFolderEnabled')}
            </label>
            {prefs.watchFolderEnabled && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    className="flex-1 h-7 px-2 rounded border bg-background"
                    value={prefs.watchFolder ?? ''}
                    onChange={(e) => updatePref('watchFolder', e.target.value)}
                    placeholder={t('prefs.watchFolderPlaceholder')}
                  />
                  <button
                    className="h-7 px-3 text-xs rounded border hover:bg-accent"
                    onClick={async () => {
                      const res = await window.api.dialogOpenDirectory();
                      if (res.success && res.data) {
                        updatePref('watchFolder', res.data);
                      }
                    }}
                  >
                    {t('dialog.browse')}
                  </button>
                </div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={prefs.deleteWatchedTorrent} onChange={(e) => updatePref('deleteWatchedTorrent', e.target.checked)} />
                  {t('prefs.deleteWatchedTorrent')}
                </label>
              </div>
            )}
          </div>

          {/* Path Mappings */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">{t('prefs.pathMappings')}</h3>
              <button onClick={addMapping} className="h-6 px-2 text-xs rounded border hover:bg-accent flex items-center gap-1">
                <Plus size={12} /> {t('prefs.pathMappingsAdd')}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              {t('prefs.pathMappingsHelp')}
            </p>
            <div className="space-y-2">
              {prefs.pathMappings.map((mapping, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    className="flex-1 h-7 px-2 rounded border bg-background"
                    value={mapping.remote}
                    onChange={(e) => updateMapping(i, 'remote', e.target.value)}
                    placeholder={t('prefs.remotePath')}
                  />
                  <span className="text-muted-foreground">→</span>
                  <input
                    type="text"
                    className="flex-1 h-7 px-2 rounded border bg-background"
                    value={mapping.local}
                    onChange={(e) => updateMapping(i, 'local', e.target.value)}
                    placeholder={t('prefs.localPath')}
                  />
                  <button onClick={() => removeMapping(i)} className="p-1 hover:bg-accent rounded text-muted-foreground">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Speed Presets */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">{t('prefs.speedPresets')}</h3>
              <button onClick={addPreset} className="h-6 px-2 text-xs rounded border hover:bg-accent flex items-center gap-1">
                <Plus size={12} /> {t('prefs.addPreset')}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{t('prefs.speedPresetsHelp')}</p>
            <div className="flex flex-wrap gap-2">
              {(prefs.speedPresets ?? [100, 500, 1000, 2000, 5000]).map((val, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input
                    type="number"
                    className="w-20 h-7 px-2 rounded border bg-background text-right"
                    value={val}
                    onChange={(e) => updatePreset(i, Number(e.target.value))}
                    min={0}
                  />
                  <span className="text-xs text-muted-foreground">KB/s</span>
                  <button onClick={() => removePreset(i)} className="p-0.5 hover:bg-accent rounded text-muted-foreground">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Backup & Restore */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-2">{t('prefs.backup')}</h3>
            <p className="text-xs text-muted-foreground mb-2">{t('prefs.exportBackupHelp')}</p>
            <div className="flex items-center gap-2">
              <button
                className="h-7 px-3 text-xs rounded border hover:bg-accent flex items-center gap-1.5"
                onClick={handleExportBackup}
              >
                <Download size={12} /> {t('prefs.exportBackup')}
              </button>
              <button
                className="h-7 px-3 text-xs rounded border hover:bg-accent flex items-center gap-1.5"
                onClick={handleImportBackup}
              >
                <Upload size={12} /> {t('prefs.importBackup')}
              </button>
            </div>
            {backupMsg && (
              <p className="text-xs text-green-600 mt-2">{backupMsg}</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t">
          <button className="h-8 px-4 text-sm rounded border hover:bg-accent" onClick={onClose}>{t('dialog.cancel')}</button>
          <button className="h-8 px-4 text-sm rounded bg-primary text-primary-foreground hover:opacity-90" onClick={save}>{t('dialog.save')}</button>
        </div>
      </div>
    </div>
  );
}
