import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import type { AppPreferences, PathMapping } from '@shared/types';

interface Props {
  onClose: () => void;
}

export function AppPrefsDialog({ onClose }: Props) {
  const [prefs, setPrefs] = useState<AppPreferences | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading || !prefs) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-card rounded-lg shadow-lg p-6">Loading...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card rounded-lg shadow-lg w-[550px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold">Application Preferences</h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded"><X size={16} /></button>
        </div>

        <div className="overflow-y-auto p-4 space-y-4 text-sm">
          {/* Polling */}
          <div>
            <h3 className="font-medium mb-2">Polling</h3>
            <div className="flex items-center gap-2">
              Refresh interval (ms):
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
            <h3 className="font-medium mb-2">Appearance</h3>
            <div className="flex items-center gap-2">
              Theme:
              <select
                className="h-7 px-2 rounded border bg-background"
                value={prefs.theme}
                onChange={(e) => updatePref('theme', e.target.value as AppPreferences['theme'])}
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </div>

          {/* Language */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-2">Language</h3>
            <select
              className="h-7 px-2 rounded border bg-background"
              value={prefs.language}
              onChange={(e) => updatePref('language', e.target.value)}
            >
              <option value="en">English</option>
              <option value="fr">Français</option>
            </select>
          </div>

          {/* Tray */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-2">System Tray</h3>
            <div className="space-y-1">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={prefs.minimizeToTray} onChange={(e) => updatePref('minimizeToTray', e.target.checked)} />
                Minimize to tray
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={prefs.closeToTray} onChange={(e) => updatePref('closeToTray', e.target.checked)} />
                Close to tray
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={prefs.showNotifications} onChange={(e) => updatePref('showNotifications', e.target.checked)} />
                Show notifications on completion
              </label>
            </div>
          </div>

          {/* Display */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-2">Display</h3>
            <div className="space-y-1">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={prefs.relativeDates} onChange={(e) => updatePref('relativeDates', e.target.checked)} />
                Use relative dates
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={prefs.confirmOnAdd} onChange={(e) => updatePref('confirmOnAdd', e.target.checked)} />
                Show confirmation when adding torrents
              </label>
            </div>
          </div>

          {/* Watch Folder */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-2">Watch Folder</h3>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={prefs.watchFolderEnabled} onChange={(e) => updatePref('watchFolderEnabled', e.target.checked)} />
              Watch a folder for .torrent files
            </label>
            {prefs.watchFolderEnabled && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    className="flex-1 h-7 px-2 rounded border bg-background"
                    value={prefs.watchFolder ?? ''}
                    onChange={(e) => updatePref('watchFolder', e.target.value)}
                    placeholder="/path/to/watch"
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
                    Browse
                  </button>
                </div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={prefs.deleteWatchedTorrent} onChange={(e) => updatePref('deleteWatchedTorrent', e.target.checked)} />
                  Delete .torrent file after adding
                </label>
              </div>
            )}
          </div>

          {/* Path Mappings */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Path Mappings (Remote → Local)</h3>
              <button onClick={addMapping} className="h-6 px-2 text-xs rounded border hover:bg-accent flex items-center gap-1">
                <Plus size={12} /> Add
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Map remote daemon paths to local paths for "Open folder" actions.
            </p>
            <div className="space-y-2">
              {prefs.pathMappings.map((mapping, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    className="flex-1 h-7 px-2 rounded border bg-background"
                    value={mapping.remote}
                    onChange={(e) => updateMapping(i, 'remote', e.target.value)}
                    placeholder="Remote path"
                  />
                  <span className="text-muted-foreground">→</span>
                  <input
                    type="text"
                    className="flex-1 h-7 px-2 rounded border bg-background"
                    value={mapping.local}
                    onChange={(e) => updateMapping(i, 'local', e.target.value)}
                    placeholder="Local path"
                  />
                  <button onClick={() => removeMapping(i)} className="p-1 hover:bg-accent rounded text-muted-foreground">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t">
          <button className="h-8 px-4 text-sm rounded border hover:bg-accent" onClick={onClose}>Cancel</button>
          <button className="h-8 px-4 text-sm rounded bg-primary text-primary-foreground hover:opacity-90" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}
