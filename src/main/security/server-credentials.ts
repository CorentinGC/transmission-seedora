import type { ServerConfig } from '@shared/types';

/** A server as the renderer may see it: no password, only whether one is stored. */
export function toPublicServer(server: ServerConfig): ServerConfig {
  const { password, proxyPassword, ...rest } = server;
  return {
    ...rest,
    hasPassword: server.hasPassword ?? Boolean(password),
    hasProxyPassword: server.hasProxyPassword ?? Boolean(proxyPassword),
  };
}

/** A server without any credential (for exports that must not carry secrets): keeps usernames, drops passwords and flags. */
export function withoutSecrets(server: ServerConfig): ServerConfig {
  const { password: _p, proxyPassword: _pp, hasPassword: _hp, hasProxyPassword: _hpp, ...rest } = server;
  return rest;
}

/** A server with its credentials but without the renderer-facing flags (for exports that include passwords). */
export function withSecrets(server: ServerConfig): ServerConfig {
  const { hasPassword: _hp, hasProxyPassword: _hpp, ...rest } = server;
  return rest;
}

type EndpointFields = Pick<ServerConfig, 'host' | 'port' | 'path' | 'useSSL' | 'allowSelfSigned'>;
type ProxyFields = Pick<ServerConfig, 'proxyType' | 'proxyHost' | 'proxyPort' | 'proxyUsername'>;

/**
 * Whether `next` targets the same daemon endpoint as `previous`, with no weaker trust: a stored password may
 * only follow an unchanged endpoint, and not one whose certificate checks were relaxed.
 */
export function sameEndpoint(previous: EndpointFields, next: EndpointFields): boolean {
  const relaxedTls = next.allowSelfSigned === true && previous.allowSelfSigned !== true;
  return (
    previous.host === next.host &&
    previous.port === next.port &&
    previous.path === next.path &&
    previous.useSSL === next.useSSL &&
    !relaxedTls
  );
}

/** Whether two configs use the same proxy (a stored proxy password may only follow an unchanged proxy). */
export function sameProxy(a: ProxyFields, b: ProxyFields): boolean {
  return (
    (a.proxyType ?? 'none') === (b.proxyType ?? 'none') &&
    a.proxyHost === b.proxyHost &&
    a.proxyPort === b.proxyPort &&
    (a.proxyUsername ?? '') === (b.proxyUsername ?? '')
  );
}

/**
 * Builds the config used by a connection test. When the test targets a stored server (`id`) and the
 * renderer sent no password, the stored password is used, but only if the endpoint is unchanged: otherwise
 * a compromised renderer could aim a stored password at a host of its choosing. An empty password means
 * "not typed", like an absent one.
 */
export function resolveTestServer(
  config: ServerConfig | (Omit<ServerConfig, 'id'> & { id?: string }),
  stored: ServerConfig | undefined,
): ServerConfig {
  const { hasPassword: _hp, hasProxyPassword: _hpp, ...input } = config;
  const base: ServerConfig = {
    ...input,
    id: input.id ?? 'test',
    password: input.password || undefined,
    proxyPassword: input.proxyPassword || undefined,
  };
  if (!stored || stored.id !== input.id) return base;

  return {
    ...base,
    password: base.password ?? (sameEndpoint(stored, base) ? stored.password : undefined),
    proxyPassword: base.proxyPassword ?? (sameProxy(stored, base) ? stored.proxyPassword : undefined),
  };
}
