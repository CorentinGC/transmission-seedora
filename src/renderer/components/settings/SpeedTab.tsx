import { useState } from 'react';
import { useSessionStore } from '../../stores/session-store';
import type { SessionSettings } from '../../types/session';

interface Props {
  settings: SessionSettings;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function SpeedTab({ settings: s }: Props) {
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
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const parseTime = (val: string) => {
    const [h, m] = val.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };

  const apply = () => {
    updateSettings({
      'speed-limit-down-enabled': speedLimitDownEnabled,
      'speed-limit-down': speedLimitDown,
      'speed-limit-up-enabled': speedLimitUpEnabled,
      'speed-limit-up': speedLimitUp,
      'alt-speed-down': altSpeedDown,
      'alt-speed-up': altSpeedUp,
      'alt-speed-time-enabled': altSpeedTimeEnabled,
      'alt-speed-time-begin': altSpeedTimeBegin,
      'alt-speed-time-end': altSpeedTimeEnd,
      'alt-speed-time-day': altSpeedTimeDay,
    });
  };

  return (
    <div className="space-y-4 text-sm">
      <div>
        <h3 className="font-medium mb-2">Speed Limits</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={speedLimitDownEnabled} onChange={(e) => setSpeedLimitDownEnabled(e.target.checked)} />
            Limit download speed (KB/s):
            <input type="number" className="w-24 h-7 px-2 rounded border bg-background" value={speedLimitDown} onChange={(e) => setSpeedLimitDown(Number(e.target.value))} disabled={!speedLimitDownEnabled} />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={speedLimitUpEnabled} onChange={(e) => setSpeedLimitUpEnabled(e.target.checked)} />
            Limit upload speed (KB/s):
            <input type="number" className="w-24 h-7 px-2 rounded border bg-background" value={speedLimitUp} onChange={(e) => setSpeedLimitUp(Number(e.target.value))} disabled={!speedLimitUpEnabled} />
          </label>
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-medium mb-2">Alternative Speed Limits (Turtle Mode)</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            Download (KB/s):
            <input type="number" className="w-24 h-7 px-2 rounded border bg-background" value={altSpeedDown} onChange={(e) => setAltSpeedDown(Number(e.target.value))} />
          </div>
          <div className="flex items-center gap-2">
            Upload (KB/s):
            <input type="number" className="w-24 h-7 px-2 rounded border bg-background" value={altSpeedUp} onChange={(e) => setAltSpeedUp(Number(e.target.value))} />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={altSpeedTimeEnabled} onChange={(e) => setAltSpeedTimeEnabled(e.target.checked)} />
            Schedule:
          </label>
          {altSpeedTimeEnabled && (
            <div className="ml-6 space-y-2">
              <div className="flex items-center gap-2">
                From:
                <input type="time" className="h-7 px-2 rounded border bg-background" value={formatTime(altSpeedTimeBegin)} onChange={(e) => setAltSpeedTimeBegin(parseTime(e.target.value))} />
                To:
                <input type="time" className="h-7 px-2 rounded border bg-background" value={formatTime(altSpeedTimeEnd)} onChange={(e) => setAltSpeedTimeEnd(parseTime(e.target.value))} />
              </div>
              <div className="flex items-center gap-2">
                Days:
                <select className="h-7 px-2 rounded border bg-background" value={altSpeedTimeDay} onChange={(e) => setAltSpeedTimeDay(Number(e.target.value))}>
                  <option value={127}>Every day</option>
                  <option value={62}>Weekdays</option>
                  <option value={65}>Weekends</option>
                  {DAYS.map((d, i) => (
                    <option key={d} value={1 << i}>{d}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t pt-4">
        <button className="h-8 px-4 text-sm rounded bg-primary text-primary-foreground hover:opacity-90" onClick={apply}>
          Apply
        </button>
      </div>
    </div>
  );
}
