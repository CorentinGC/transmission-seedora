import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2 } from 'lucide-react';
import { useServerStore } from '../../stores/server-store';
import type { ServerConfig, NewServerConfig } from '../../types/server';

interface Props {
  server?: ServerConfig;
  onClose: () => void;
}

export function ServerFormDialog({ server, onClose }: Props) {
  const { t } = useTranslation();
  const addServer = useServerStore((s) => s.addServer);
  const updateServer = useServerStore((s) => s.updateServer);
  const testConnection = useServerStore((s) => s.testConnection);
  const setActiveServer = useServerStore((s) => s.setActiveServer);

  const [name, setName] = useState(server?.name ?? '');
  const [host, setHost] = useState(server?.host ?? 'localhost');
  const [port, setPort] = useState(server?.port ?? 9091);
  const [path, setPath] = useState(server?.path ?? '/transmission/rpc');
  const [useSSL, setUseSSL] = useState(server?.useSSL ?? false);
  const [username, setUsername] = useState(server?.username ?? '');
  const [password, setPassword] = useState(server?.password ?? '');
  const [proxyType, setProxyType] = useState<'none' | 'http' | 'socks5'>(server?.proxyType ?? 'none');
  const [proxyHost, setProxyHost] = useState(server?.proxyHost ?? '');
  const [proxyPort, setProxyPort] = useState(server?.proxyPort ?? 8080);
  const [proxyUsername, setProxyUsername] = useState(server?.proxyUsername ?? '');
  const [proxyPassword, setProxyPassword] = useState(server?.proxyPassword ?? '');

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  const getConfig = (): NewServerConfig => ({
    name: name || `${host}:${port}`,
    host, port, path, useSSL,
    username: username || undefined,
    password: password || undefined,
    proxyType,
    proxyHost: proxyType !== 'none' ? proxyHost : undefined,
    proxyPort: proxyType !== 'none' ? proxyPort : undefined,
    proxyUsername: proxyType !== 'none' ? proxyUsername : undefined,
    proxyPassword: proxyType !== 'none' ? proxyPassword : undefined,
  });

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await testConnection(getConfig());
    setTestResult(result);
    setTesting(false);
  };

  const handleSave = async () => {
    setSaving(true);
    if (server) {
      await updateServer(server.id, getConfig());
    } else {
      const newServer = await addServer(getConfig());
      if (newServer) {
        await setActiveServer(newServer.id);
      }
    }
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border rounded-lg shadow-xl w-[480px] max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {server ? t('server.editServer') : t('server.addServerTitle')}
          </h2>
          <button onClick={onClose} className="hover:bg-accent rounded p-1">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <Field label={t('server.serverName')} value={name} onChange={setName} placeholder={t('server.serverNamePlaceholder')} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('server.host')} value={host} onChange={setHost} />
            <Field label={t('server.port')} value={String(port)} onChange={(v) => setPort(Number(v))} type="number" />
          </div>
          <Field label={t('server.path')} value={path} onChange={setPath} />

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={useSSL} onChange={(e) => setUseSSL(e.target.checked)} />
            {t('server.useSSL')}
          </label>

          <div className="border-t pt-3">
            <h3 className="text-sm font-medium mb-2">{t('server.authentication')}</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('server.username')} value={username} onChange={setUsername} />
              <Field label={t('server.password')} value={password} onChange={setPassword} type="password" />
            </div>
          </div>

          <div className="border-t pt-3">
            <h3 className="text-sm font-medium mb-2">{t('server.proxy')}</h3>
            <select
              className="w-full h-8 px-2 text-sm rounded border bg-background"
              value={proxyType}
              onChange={(e) => setProxyType(e.target.value as 'none' | 'http' | 'socks5')}
            >
              <option value="none">{t('server.proxyNone')}</option>
              <option value="http">{t('server.proxyHTTP')}</option>
              <option value="socks5">{t('server.proxySOCKS5')}</option>
            </select>
            {proxyType !== 'none' && (
              <div className="mt-2 space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t('server.proxyHost')} value={proxyHost} onChange={setProxyHost} />
                  <Field label={t('server.proxyPort')} value={String(proxyPort)} onChange={(v) => setProxyPort(Number(v))} type="number" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t('server.proxyUsername')} value={proxyUsername} onChange={setProxyUsername} />
                  <Field label={t('server.proxyPassword')} value={proxyPassword} onChange={setProxyPassword} type="password" />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between p-4 border-t">
          <div className="flex items-center gap-2">
            <button
              className="h-8 px-3 text-sm rounded border hover:bg-accent disabled:opacity-50"
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? <Loader2 size={14} className="animate-spin" /> : t('dialog.test')}
            </button>
            {testResult !== null && (
              <span className={`text-sm ${testResult ? 'text-green-500' : 'text-red-500'}`}>
                {testResult ? t('server.testSuccess') : t('server.testFailed')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button className="h-8 px-3 text-sm rounded border hover:bg-accent" onClick={onClose}>
              {t('dialog.cancel')}
            </button>
            <button
              className="h-8 px-4 text-sm rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
              onClick={handleSave}
              disabled={saving || !host}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : t('dialog.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        type={type}
        className="w-full h-8 px-2 text-sm rounded border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
