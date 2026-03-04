import { useState } from 'react';
import { X } from 'lucide-react';
import { useTorrentStore } from '../../stores/torrent-store';

interface Props {
  torrentId: number;
  currentName: string;
  onClose: () => void;
}

export function RenameTorrentDialog({ torrentId, currentName, onClose }: Props) {
  const [name, setName] = useState(currentName);

  const handleRename = async () => {
    if (name.trim() && name !== currentName) {
      await window.api.rpcTorrentRenamePath([torrentId], currentName, name.trim());
      useTorrentStore.getState().fetchRecentlyActive();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border rounded-lg shadow-xl w-[420px]">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Rename Torrent</h2>
          <button onClick={onClose} className="hover:bg-accent rounded p-1"><X size={16} /></button>
        </div>
        <div className="p-4">
          <label className="text-xs text-muted-foreground">Name</label>
          <input
            type="text"
            className="w-full h-8 px-2 text-sm rounded border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
          />
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t">
          <button className="h-8 px-3 text-sm rounded border hover:bg-accent" onClick={onClose}>Cancel</button>
          <button className="h-8 px-4 text-sm rounded bg-primary text-primary-foreground hover:opacity-90" onClick={handleRename} disabled={!name.trim() || name === currentName}>
            Rename
          </button>
        </div>
      </div>
    </div>
  );
}
