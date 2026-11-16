import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '../../stores/session-store';
import type { SessionSettings } from '../../types/session';
import { Button } from '../ui';
import { ApplyStatus, type ApplyState } from './ApplyStatus';

interface Props {
  settings: SessionSettings;
}

const DAY_KEYS = [
  'speedTab.sun',
  'speedTab.mon',
  'speedTab.tue',
  'speedTab.wed',
  'speedTab.thu',
  'speedTab.fri',
  'speedTab.sat',
];

export function SpeedTab({ settings: s }: Props) {
  const { t } = useTranslation();
  const updateSettings = useSessionStore((st) => st.updateSettings);

  const [speedLimitDownEnabled, setSpeedLimitDownEnabled] = useState(s.speedLimitDownEnabled);
  const [speedLimitDown, setSpeedLimitDown] = useState(s.speedLimitDown);
  const [speedLimitUpEnabled, setSpeedLimitUpEnabled] = useState(s.speedLimitUpEnabled);
  const [speedLimitUp, setSpeedLimitUp] = useState(s.speedLimitUp);
  const [altSpeedDown, setAltSpeedDown] = useState(s.altSpeedDown);
  const [altSpeedUp, setAltSpeedUp] = useState(s.altSpeedUp);
  const [altSpeedTimeEnabled, setAltSpeedTimeEnabled] = useState(s.altSpeedTimeEnabled);
  const [altSpeedTimeBegin, setAltSpeedTimeBegin] = useState(s.altSpeedTimeBegin);
  const [altSpeedTimeEnd, setAltSpeedTimeEnd] = useState(s.altSpeedTimeEnd);
  const [altSpeedTimeDay, setAltSpeedTimeDay] = useState(s.altSpeedTimeDay);

  const formatTime = (mins: number) => {
    const h = Math.floor(mins / 60)
      .toString()
      .padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const parseTime = (val: string) => {
    const [h, m] = val.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };

  const [applyStatus, setApplyStatus] = useState<ApplyState>('idle');

  const apply = async () => {
    const ok = await updateSettings({
      speedLimitDownEnabled,
      speedLimitDown,
      speedLimitUpEnabled,
      speedLimitUp,
      altSpeedDown,
      altSpeedUp,
      altSpeedTimeEnabled,
      altSpeedTimeBegin,
      altSpeedTimeEnd,
      altSpeedTimeDay,
    });
    setApplyStatus(ok ? 'success' : 'error');
    setTimeout(() => setApplyStatus('idle'), 3000);
  };

  return (
    <div className="space-y-4 text-sm">
      <div>
        <h3 className="font-medium mb-2">{t('speedTab.speedLimits')}</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={speedLimitDownEnabled}
              onChange={(e) => setSpeedLimitDownEnabled(e.target.checked)}
            />
            {t('speedTab.limitDownload')}
            <input
              type="number"
              aria-label={t('speedTab.limitDownload')}
              className="w-24 h-7 px-2 rounded border bg-background"
              value={speedLimitDown}
              onChange={(e) => setSpeedLimitDown(Number(e.target.value))}
              disabled={!speedLimitDownEnabled}
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={speedLimitUpEnabled}
              onChange={(e) => setSpeedLimitUpEnabled(e.target.checked)}
            />
            {t('speedTab.limitUpload')}
            <input
              type="number"
              aria-label={t('speedTab.limitUpload')}
              className="w-24 h-7 px-2 rounded border bg-background"
              value={speedLimitUp}
              onChange={(e) => setSpeedLimitUp(Number(e.target.value))}
              disabled={!speedLimitUpEnabled}
            />
          </label>
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-medium mb-2">{t('speedTab.altSpeedLimits')}</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            {t('speedTab.altDownload')}
            <input
              type="number"
              className="w-24 h-7 px-2 rounded border bg-background"
              value={altSpeedDown}
              onChange={(e) => setAltSpeedDown(Number(e.target.value))}
            />
          </label>
          <label className="flex items-center gap-2">
            {t('speedTab.altUpload')}
            <input
              type="number"
              className="w-24 h-7 px-2 rounded border bg-background"
              value={altSpeedUp}
              onChange={(e) => setAltSpeedUp(Number(e.target.value))}
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={altSpeedTimeEnabled}
              onChange={(e) => setAltSpeedTimeEnabled(e.target.checked)}
            />
            {t('speedTab.schedule')}
          </label>
          {altSpeedTimeEnabled && (
            <div className="ml-6 space-y-2">
              <div className="flex items-center gap-2">
                {t('speedTab.from')}
                <input
                  type="time"
                  aria-label={t('speedTab.from')}
                  className="h-7 px-2 rounded border bg-background"
                  value={formatTime(altSpeedTimeBegin)}
                  onChange={(e) => setAltSpeedTimeBegin(parseTime(e.target.value))}
                />
                {t('speedTab.to')}
                <input
                  type="time"
                  aria-label={t('speedTab.to')}
                  className="h-7 px-2 rounded border bg-background"
                  value={formatTime(altSpeedTimeEnd)}
                  onChange={(e) => setAltSpeedTimeEnd(parseTime(e.target.value))}
                />
              </div>
              <label className="flex items-center gap-2">
                {t('speedTab.days')}
                <select
                  className="h-7 px-2 rounded border bg-background"
                  value={altSpeedTimeDay}
                  onChange={(e) => setAltSpeedTimeDay(Number(e.target.value))}
                >
                  <option value={127}>{t('speedTab.everyDay')}</option>
                  <option value={62}>{t('speedTab.weekdays')}</option>
                  <option value={65}>{t('speedTab.weekends')}</option>
                  {DAY_KEYS.map((key, i) => (
                    <option key={key} value={1 << i}>
                      {t(key)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="border-t pt-4 flex items-center gap-3">
        <Button variant="primary" onClick={apply}>
          {t('dialog.apply')}
        </Button>
        <ApplyStatus status={applyStatus} />
      </div>
    </div>
  );
}
