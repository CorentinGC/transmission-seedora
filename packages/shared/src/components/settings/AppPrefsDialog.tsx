import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Download, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AppPreferences, IpcResponse } from '../../types';
import { useUiStore } from '../../stores/ui-store';
import { useApi } from '../../platform/api-context';
import { guardedCall } from '../../lib/guarded-call';
import { runConfigExport } from '../../lib/config-export';
import { availableLanguages, getLanguageName } from '../../lib/i18n-utils';
import { hasValidNumbers, parseNumberInput, MIN_POLLING_INTERVAL_MS } from '../../lib/prefs-validation';
import { Dialog, Button, Input, Select, Checkbox, SectionHeading } from '../ui';
import { ExportPasswordsOption } from '../server/ExportPasswordsOption';

interface Props {
  onClose: () => void;
}

export function AppPrefsDialog({ onClose }: Props) {
  const [prefs, setPrefs] = useState<AppPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const backupFileRef = useRef<HTMLInputElement>(null);
  const { t, i18n } = useTranslation();
  const api = useApi();
  const setTheme = useUiStore((s) => s.setTheme);
  const setPollingInterval = useUiStore((s) => s.setPollingInterval);
  const setRelativeDates = useUiStore((s) => s.setRelativeDates);

  useEffect(() => {
    guardedCall(() => api.prefsGet(), 'notification.prefsLoadFailed').then((res) => {
      if (res?.data) setPrefs(res.data);
      setLoading(false);
    });
  }, [api]);

  const save = async () => {
    if (!prefs || !hasValidNumbers(prefs)) return;
    setSaveError(null);
    const res = await api.prefsSet(prefs);
    if (!res.success) {
      setSaveError(res.error ? `${t('prefs.saveFailed')} (${res.error})` : t('prefs.saveFailed'));
      return;
    }

    setTheme(prefs.theme);
    setPollingInterval(prefs.pollingInterval);
    setRelativeDates(prefs.relativeDates);

    if (i18n.language !== prefs.language) {
      i18n.changeLanguage(prefs.language);
    }

    useUiStore.getState().setSpeedPresets(prefs.speedPresets ?? null);
    api.watcherRestart?.();
    onClose();
  };

  const updatePref = <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => {
    setPrefs((p) => (p ? { ...p, [key]: value } : p));
  };

  const [includePasswords, setIncludePasswords] = useState(false);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [backupFailed, setBackupFailed] = useState(false);

  const showImportFailed = () => {
    setBackupMsg(t('prefs.importFailed'));
    setBackupFailed(true);
    setTimeout(() => {
      setBackupMsg(null);
      setBackupFailed(false);
    }, 3000);
  };

  const handleExportBackup = () =>
    runConfigExport(api, { servers: true, preferences: true, includePasswords }, 'seedora-backup.json');

  /** Runs a backup import, shows its outcome inline and reloads the preferences it may have replaced. */
  const runImport = async (call: () => Promise<IpcResponse>) => {
    try {
      const importRes = await call();
      if (!importRes.success) {
        showImportFailed();
        return;
      }
      setBackupMsg(t('prefs.importSuccess'));
      const prefsRes = await guardedCall(() => api.prefsGet(), 'notification.prefsLoadFailed');
      if (prefsRes?.data) setPrefs(prefsRes.data);
      setTimeout(() => setBackupMsg(null), 3000);
    } catch {
      showImportFailed();
    }
  };

  const handleImportBackup = async () => {
    if (api.dialogOpenFile) {
      // Electron: native file dialog
      const openFile = api.dialogOpenFile.bind(api);
      const fileRes = await guardedCall(
        () => openFile({ properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] }),
        'notification.pickerFailed',
      );
      const filePath = fileRes?.data?.[0];
      if (filePath) await runImport(() => api.configImport({ filePath }));
    } else {
      // Web: trigger hidden file input
      backupFileRef.current?.click();
    }
  };

  const handleBackupFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await runImport(async () => api.configImport(JSON.parse(await file.text())));
    e.target.value = '';
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

  const numbersValid = prefs ? hasValidNumbers(prefs) : true;

  if (loading || !prefs) {
    return (
      <Dialog title={t('prefs.title')} onClose={onClose}>
        <p className="text-sm text-muted-foreground">{t('app.loading')}</p>
      </Dialog>
    );
  }

  return (
    <Dialog
      title={t('prefs.title')}
      onClose={onClose}
      width="w-[550px]"
      maxHeight="max-h-[80vh]"
      footer={
        <div className="space-y-2">
          {!numbersValid && <p className="text-xs text-destructive-text">{t('prefs.invalidValues')}</p>}
          {saveError && (
            <p role="alert" className="text-xs text-destructive-text">
              {saveError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button onClick={onClose}>{t('dialog.cancel')}</Button>
            <Button variant="primary" onClick={save} disabled={!numbersValid}>
              {t('dialog.save')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        {/* Polling */}
        <div>
          <SectionHeading>{t('prefs.polling')}</SectionHeading>
          <div className="flex items-center gap-2">
            {t('prefs.refreshInterval')}
            <Input
              inputSize="sm"
              type="number"
              min={MIN_POLLING_INTERVAL_MS}
              step={500}
              className="w-24"
              aria-label={t('prefs.refreshInterval')}
              aria-invalid={!Number.isFinite(prefs.pollingInterval) || prefs.pollingInterval < MIN_POLLING_INTERVAL_MS}
              value={Number.isNaN(prefs.pollingInterval) ? '' : prefs.pollingInterval}
              onChange={(e) => updatePref('pollingInterval', parseNumberInput(e.target.value))}
            />
          </div>
        </div>

        {/* Theme */}
        <SectionHeading bordered>{t('prefs.appearance')}</SectionHeading>
        <div className="flex items-center gap-2">
          {t('prefs.theme')}
          <Select
            selectSize="sm"
            value={prefs.theme}
            onChange={(e) => updatePref('theme', e.target.value as AppPreferences['theme'])}
          >
            <option value="system">{t('prefs.themeSystem')}</option>
            <option value="light">{t('prefs.themeLight')}</option>
            <option value="dark">{t('prefs.themeDark')}</option>
          </Select>
        </div>

        {/* Language */}
        <SectionHeading bordered>{t('prefs.language')}</SectionHeading>
        <Select selectSize="sm" value={prefs.language} onChange={(e) => updatePref('language', e.target.value)}>
          {availableLanguages.map((code) => (
            <option key={code} value={code}>
              {getLanguageName(code)}
            </option>
          ))}
        </Select>

        {/* Tray */}
        <SectionHeading bordered>{t('prefs.tray')}</SectionHeading>
        <div className="space-y-1">
          <Checkbox
            label={t('prefs.minimizeToTray')}
            checked={prefs.minimizeToTray}
            onChange={(e) => updatePref('minimizeToTray', (e.target as HTMLInputElement).checked)}
          />
          <Checkbox
            label={t('prefs.closeToTray')}
            checked={prefs.closeToTray}
            onChange={(e) => updatePref('closeToTray', (e.target as HTMLInputElement).checked)}
          />
          <Checkbox
            label={t('prefs.showNotifications')}
            checked={prefs.showNotifications}
            onChange={(e) => updatePref('showNotifications', (e.target as HTMLInputElement).checked)}
          />
        </div>

        {/* Display */}
        <SectionHeading bordered>{t('prefs.display')}</SectionHeading>
        <div className="space-y-1">
          <Checkbox
            label={t('prefs.relativeDates')}
            checked={prefs.relativeDates}
            onChange={(e) => updatePref('relativeDates', (e.target as HTMLInputElement).checked)}
          />
        </div>

        {/* Watch Folder */}
        <SectionHeading bordered>{t('prefs.watchFolder')}</SectionHeading>
        <Checkbox
          label={t('prefs.watchFolderEnabled')}
          checked={prefs.watchFolderEnabled}
          onChange={(e) => updatePref('watchFolderEnabled', (e.target as HTMLInputElement).checked)}
        />
        {prefs.watchFolderEnabled && (
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                inputSize="sm"
                className="flex-1"
                value={prefs.watchFolder ?? ''}
                readOnly
                placeholder={t('prefs.watchFolderPlaceholder')}
              />
              <Button
                size="sm"
                onClick={async () => {
                  if (!api.dialogOpenDirectory) return;
                  const openDirectory = api.dialogOpenDirectory.bind(api);
                  const res = await guardedCall(
                    () => openDirectory({ purpose: 'watch-folder' }),
                    'notification.pickerFailed',
                  );
                  if (res?.data) updatePref('watchFolder', res.data);
                }}
              >
                {t('dialog.browse')}
              </Button>
            </div>
            <Checkbox
              label={t('prefs.deleteWatchedTorrent')}
              checked={prefs.deleteWatchedTorrent}
              onChange={(e) => updatePref('deleteWatchedTorrent', (e.target as HTMLInputElement).checked)}
            />
          </div>
        )}

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
              <Input
                inputSize="sm"
                type="number"
                className="w-20 text-right"
                aria-label={t('prefs.speedPresets')}
                aria-invalid={!Number.isFinite(val) || val < 0}
                value={Number.isNaN(val) ? '' : val}
                onChange={(e) => updatePreset(i, parseNumberInput(e.target.value))}
                min={0}
              />
              <span className="text-xs text-muted-foreground">{t('statusBar.kbs')}</span>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => removePreset(i)}
                aria-label={t('prefs.removePreset')}
                className="text-muted-foreground p-0.5"
              >
                <Trash2 size={12} />
              </Button>
            </div>
          ))}
        </div>

        {/* Backup & Restore */}
        <input ref={backupFileRef} type="file" accept=".json" className="hidden" onChange={handleBackupFileChange} />
        <SectionHeading bordered>{t('prefs.backup')}</SectionHeading>
        <p className="text-xs text-muted-foreground mb-2">{t('prefs.exportBackupHelp')}</p>
        <ExportPasswordsOption className="mb-2" checked={includePasswords} onChange={setIncludePasswords} />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleExportBackup} className="flex items-center gap-1.5">
            <Download size={12} /> {t('prefs.exportBackup')}
          </Button>
          <Button size="sm" onClick={handleImportBackup} className="flex items-center gap-1.5">
            <Upload size={12} /> {t('prefs.importBackup')}
          </Button>
        </div>
        {backupMsg && (
          <p role="status" className={`text-xs mt-2 ${backupFailed ? 'text-destructive-text' : 'text-success'}`}>
            {backupMsg}
          </p>
        )}
      </div>
    </Dialog>
  );
}
