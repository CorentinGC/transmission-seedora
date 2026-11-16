import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useServerStore } from '../../stores/server-store';
import type { ServerConfig, NewServerConfig } from '../../types/server';
import type { ServerConfigPatch } from '../../types';
import { isSecretStorageUnencrypted } from '../../lib/secret-storage';
import { useApi } from '../../platform/api-context';
import { isWebPlatform } from '../../platform/capabilities';
import { Dialog, Button, Input, Select, Checkbox, Field, SectionHeading } from '../ui';

interface Props {
  server?: ServerConfig;
  onClose: () => void;
}

export function ServerFormDialog({ server, onClose }: Props) {
  const { t } = useTranslation();
  const api = useApi();
  const showStorageWarning = isWebPlatform(api);
  const [unencrypted, setUnencrypted] = useState(false);
  useEffect(() => {
    let current = true;
    void isSecretStorageUnencrypted(api).then((value) => {
      if (current) setUnencrypted(value);
    });
    return () => {
      current = false;
    };
  }, [api]);
  const addServer = useServerStore((s) => s.addServer);
  const updateServer = useServerStore((s) => s.updateServer);
  const testConnection = useServerStore((s) => s.testConnection);
  const setActiveServer = useServerStore((s) => s.setActiveServer);

  const [name, setName] = useState(server?.name ?? '');
  const [host, setHost] = useState(server?.host ?? 'localhost');
  const [port, setPort] = useState(server?.port ?? 9091);
  const [path, setPath] = useState(server?.path ?? '/transmission/rpc');
  const [useSSL, setUseSSL] = useState(server?.useSSL ?? false);
  const [allowSelfSigned, setAllowSelfSigned] = useState(server?.allowSelfSigned ?? false);
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
  const [saveFailed, setSaveFailed] = useState(false);
  const [saveReason, setSaveReason] = useState<string | null>(null);
  const [clearPassword, setClearPassword] = useState(false);
  const [clearProxyPassword, setClearProxyPassword] = useState(false);

  const getConfig = (): NewServerConfig & ServerConfigPatch => ({
    name: name || `${host}:${port}`,
    host,
    port,
    path,
    useSSL,
    allowSelfSigned: useSSL ? allowSelfSigned : undefined,
    username: username || undefined,
    password: clearPassword ? undefined : password || undefined,
    clearPassword: server?.hasPassword && clearPassword ? true : undefined,
    clearProxyPassword: server?.hasProxyPassword && clearProxyPassword ? true : undefined,
    proxyType,
    proxyHost: proxyType !== 'none' ? proxyHost : undefined,
    proxyPort: proxyType !== 'none' ? proxyPort : undefined,
    proxyUsername: proxyType !== 'none' ? proxyUsername : undefined,
    proxyPassword: proxyType !== 'none' && !clearProxyPassword ? proxyPassword : undefined,
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
    setSaveFailed(false);
    setSaveReason(null);
    let failure: string | null | undefined;
    if (server) {
      const res = await updateServer(server.id, getConfig());
      if (!res.ok) failure = res.reason;
    } else {
      const res = await addServer(getConfig());
      if (res.ok) await setActiveServer(res.data.id);
      else failure = res.reason;
    }
    setSaving(false);
    if (failure !== undefined) {
      setSaveReason(failure);
      setSaveFailed(true);
      return;
    }
    onClose();
  };

  return (
    <Dialog
      title={server ? t('server.editServer') : t('server.addServerTitle')}
      onClose={onClose}
      width="w-[480px]"
      maxHeight="max-h-[80vh]"
      footer={
        <div className="flex flex-col gap-2">
          {saveFailed && (
            <p role="alert" className="text-sm text-destructive-text">
              {saveReason ?? t('server.saveFailed')}
            </p>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button onClick={handleTest} disabled={testing}>
                {testing ? <Loader2 size={14} className="animate-spin" /> : t('dialog.test')}
              </Button>
              {testResult !== null && (
                <span role="status" className={`text-sm ${testResult ? 'text-success' : 'text-destructive-text'}`}>
                  {testResult ? t('server.testSuccess') : t('server.testFailed')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={onClose}>{t('dialog.cancel')}</Button>
              <Button variant="primary" onClick={handleSave} disabled={saving || !host}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : t('dialog.save')}
              </Button>
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label={t('server.serverName')}>
          <Input
            className="w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('server.serverNamePlaceholder')}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('server.host')}>
            <Input className="w-full" value={host} onChange={(e) => setHost(e.target.value)} />
          </Field>
          <Field label={t('server.port')}>
            <Input
              className="w-full"
              type="number"
              value={String(port)}
              onChange={(e) => setPort(Number(e.target.value))}
            />
          </Field>
        </div>
        <Field label={t('server.path')}>
          <Input className="w-full" value={path} onChange={(e) => setPath(e.target.value)} />
        </Field>

        <Checkbox
          label={t('server.useSSL')}
          checked={useSSL}
          onChange={(e) => setUseSSL((e.target as HTMLInputElement).checked)}
          className="text-sm"
        />
        {useSSL && (
          <div className="space-y-1">
            <Checkbox
              label={t('server.allowSelfSigned')}
              checked={allowSelfSigned}
              onChange={(e) => setAllowSelfSigned((e.target as HTMLInputElement).checked)}
              aria-describedby="allow-self-signed-hint"
              className="text-sm"
            />
            <p id="allow-self-signed-hint" className="text-xs text-muted-foreground">
              {t('server.allowSelfSignedHint')}
            </p>
          </div>
        )}

        <div className="border-t pt-3">
          <SectionHeading>{t('server.authentication')}</SectionHeading>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('server.username')}>
              <Input className="w-full" value={username} onChange={(e) => setUsername(e.target.value)} />
            </Field>
            <Field label={t('server.password')}>
              <Input
                className="w-full"
                type="password"
                autoComplete="new-password"
                disabled={clearPassword}
                placeholder={server?.hasPassword ? t('server.passwordStored') : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
          </div>
          {server?.hasPassword && (
            <Checkbox
              label={t('server.removeStoredPassword')}
              checked={clearPassword}
              onChange={(e) => setClearPassword((e.target as HTMLInputElement).checked)}
              className="mt-2 text-sm"
            />
          )}
          {unencrypted && (password || proxyPassword || server?.hasPassword || server?.hasProxyPassword) && (
            <p role="note" className="mt-2 text-xs text-warning">
              {t('server.secretStorageUnencrypted')}
            </p>
          )}
          {showStorageWarning && (
            <p role="note" className="mt-2 text-xs text-muted-foreground">
              {t('server.webStorageWarning')}
            </p>
          )}
        </div>

        <div className="border-t pt-3">
          <SectionHeading>{t('server.proxy')}</SectionHeading>
          <Select
            className="w-full"
            aria-label={t('server.proxy')}
            value={proxyType}
            onChange={(e) => setProxyType(e.target.value as 'none' | 'http' | 'socks5')}
          >
            <option value="none">{t('server.proxyNone')}</option>
            <option value="http">{t('server.proxyHTTP')}</option>
            <option value="socks5">{t('server.proxySOCKS5')}</option>
          </Select>
          {proxyType !== 'none' && (
            <div className="mt-2 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('server.proxyHost')}>
                  <Input className="w-full" value={proxyHost} onChange={(e) => setProxyHost(e.target.value)} />
                </Field>
                <Field label={t('server.proxyPort')}>
                  <Input
                    className="w-full"
                    type="number"
                    value={String(proxyPort)}
                    onChange={(e) => setProxyPort(Number(e.target.value))}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('server.proxyUsername')}>
                  <Input className="w-full" value={proxyUsername} onChange={(e) => setProxyUsername(e.target.value)} />
                </Field>
                <Field label={t('server.proxyPassword')}>
                  <Input
                    className="w-full"
                    type="password"
                    autoComplete="new-password"
                    disabled={clearProxyPassword}
                    placeholder={server?.hasProxyPassword ? t('server.passwordStored') : undefined}
                    value={proxyPassword}
                    onChange={(e) => setProxyPassword(e.target.value)}
                  />
                </Field>
              </div>
              {server?.hasProxyPassword && (
                <Checkbox
                  label={t('server.removeStoredProxyPassword')}
                  checked={clearProxyPassword}
                  onChange={(e) => setClearProxyPassword((e.target as HTMLInputElement).checked)}
                  className="text-sm"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
