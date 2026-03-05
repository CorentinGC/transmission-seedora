import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '../../stores/session-store';
import { useUiStore } from '../../stores/ui-store';

interface Props {
  x: number;
  y: number;
  direction: 'down' | 'up';
  onClose: () => void;
}

const DEFAULT_PRESETS = [100, 500, 1000, 2000, 5000];

export function SpeedLimitPopover({ x, y, direction, onClose }: Props) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const settings = useSessionStore((s) => s.settings);
  const updateSettings = useSessionStore((s) => s.updateSettings);
  const speedPresets = useUiStore((s) => s.speedPresets);

  const isDown = direction === 'down';
  const limitKey = isDown ? 'speedLimitDown' : 'speedLimitUp';
  const enabledKey = isDown ? 'speedLimitDownEnabled' : 'speedLimitUpEnabled';

  const currentEnabled = (isDown ? settings?.speedLimitDownEnabled : settings?.speedLimitUpEnabled) ?? false;
  const currentLimit = (isDown ? settings?.speedLimitDown : settings?.speedLimitUp) ?? 0;

  const [customValue, setCustomValue] = useState('');

  const presets = speedPresets ?? DEFAULT_PRESETS;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  const applyPreset = async (value: number) => {
    await updateSettings({ [enabledKey]: true, [limitKey]: value });
    onClose();
  };

  const setUnlimited = async () => {
    await updateSettings({ [enabledKey]: false });
    onClose();
  };

  const applyCustom = async () => {
    const val = Math.max(0, parseInt(customValue, 10) || 0);
    if (val > 0) {
      await updateSettings({ [enabledKey]: true, [limitKey]: val });
    } else {
      await updateSettings({ [enabledKey]: false });
    }
    onClose();
  };

  // Position above the click point
  const popoverWidth = 200;
  const popoverHeight = 240;
  const left = Math.min(x - popoverWidth / 2, window.innerWidth - popoverWidth - 8);
  const top = Math.max(8, y - popoverHeight - 8);

  return (
    <div
      ref={ref}
      className="fixed z-50 rounded-md border bg-popover shadow-lg p-2 text-sm"
      style={{ left: Math.max(8, left), top, width: popoverWidth }}
    >
      <div className="text-xs font-medium text-muted-foreground mb-1.5 px-1">
        {t('statusBar.speedLimit')} ({isDown ? '↓' : '↑'})
      </div>

      {/* Unlimited button */}
      <button
        className={`w-full text-left px-2 py-1 text-xs rounded hover:bg-accent ${
          !currentEnabled ? 'bg-primary/10 text-primary font-medium' : ''
        }`}
        onClick={setUnlimited}
      >
        {t('statusBar.unlimited')}
      </button>

      {/* Preset buttons */}
      {presets.filter(v => v > 0).sort((a, b) => a - b).map((value) => (
        <button
          key={value}
          className={`w-full text-left px-2 py-1 text-xs rounded hover:bg-accent ${
            currentEnabled && currentLimit === value ? 'bg-primary/10 text-primary font-medium' : ''
          }`}
          onClick={() => applyPreset(value)}
        >
          {value} {t('statusBar.kbs')}
        </button>
      ))}

      {/* Custom input */}
      <div className="border-t mt-1.5 pt-1.5">
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') applyCustom(); }}
            className="flex-1 px-2 py-1 text-xs border rounded bg-background"
            placeholder={String(currentLimit || '')}
            min={0}
          />
          <span className="text-xs text-muted-foreground">{t('statusBar.kbs')}</span>
        </div>
        <button
          className="w-full mt-1 px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={applyCustom}
        >
          {t('statusBar.setLimit')}
        </button>
      </div>
    </div>
  );
}
