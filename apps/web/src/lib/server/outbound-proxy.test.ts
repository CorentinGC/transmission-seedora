import { execFile, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { buildSync } from 'esbuild';
import { afterEach, describe, expect, it } from 'vitest';

const run = promisify(execFile);

/**
 * True when this Node understands `NODE_USE_ENV_PROXY` (it ships together with the `--use-env-proxy`
 * flag; an older Node exits with "bad option"). Decided before anything is spawned, so a Node that
 * does support it can never skip silently.
 */
const supportsEnvProxy = spawnSync(process.execPath, ['--use-env-proxy', '-e', '0'], { stdio: 'ignore' }).status === 0;

/**
 * Child process: Node reads `HTTP_PROXY` at startup when `NODE_USE_ENV_PROXY=1`, so the check
 * needs a fresh process. It sends one call through `postJson` (/x) and one control call through
 * the global agent (/y); the parent's proxy records which of them it saw.
 */
const CHILD_SOURCE = (bundle: string) => `import http from 'node:http';
import { postJson } from ${JSON.stringify(bundle)};
const target = http.createServer((q, r) => { q.resume(); r.end('{"via":"target"}'); });
await new Promise((ok) => target.listen(0, '127.0.0.1', ok));
const targetPort = target.address().port;
const resolver = async () => [{ address: '127.0.0.1', family: 4 }];
const res = await postJson({ host: 'daemon.test', port: targetPort, path: '/x', useSSL: false }, {}, { allowPrivate: true, allowedHosts: null, resolver, signal: AbortSignal.timeout(5000) });
await new Promise((ok) => {
  const q = http.request({ host: 'daemon.test', port: targetPort, path: '/y', method: 'POST', lookup: (h, o, cb) => cb(null, '127.0.0.1', 4) }, (r) => { r.resume(); r.on('end', ok); });
  q.on('error', ok);
  q.end();
});
console.log(JSON.stringify({ json: res.json }));
process.exit(0);`;

let proxy: http.Server | undefined;
let dir: string | undefined;

afterEach(async () => {
  proxy?.closeAllConnections();
  await new Promise((resolve) => (proxy ? proxy.close(resolve) : resolve(undefined)));
  proxy = undefined;
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

describe('postJson: ignores proxy environment variables (agent: false)', () => {
  it.skipIf(!supportsEnvProxy)('connects directly even with HTTP_PROXY and NODE_USE_ENV_PROXY set', async () => {
    const seen: string[] = [];
    proxy = http.createServer((req, res) => {
      seen.push(req.url ?? '');
      req.resume();
      res.end('{"via":"proxy"}');
    });
    // The parent owns the proxy socket (port 0, never released), so there is no probe-then-bind race.
    await new Promise<void>((resolve) => proxy?.listen(0, '127.0.0.1', resolve));
    const proxyUrl = `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`;

    dir = mkdtempSync(path.join(tmpdir(), 'seedora-proxy-'));
    const bundle = path.join(dir, 'outbound.mjs');
    buildSync({
      entryPoints: [path.join(__dirname, 'outbound.ts')],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile: bundle,
      logLevel: 'silent',
    });
    const script = path.join(dir, 'child.mjs');
    writeFileSync(script, CHILD_SOURCE(bundle));

    const { stdout } = await run(process.execPath, [script], {
      env: {
        ...process.env,
        HTTP_PROXY: proxyUrl,
        http_proxy: proxyUrl,
        NODE_USE_ENV_PROXY: '1',
        NO_PROXY: '',
        no_proxy: '',
      },
      encoding: 'utf8',
      timeout: 20_000,
    });
    const result = JSON.parse(stdout.trim().split('\n').pop() ?? '{}') as { json: { via: string } };

    // Control: the global agent really is proxied in this process, so the check below is not vacuous.
    expect(seen.some((url) => url.endsWith('/y'))).toBe(true);
    expect(result.json).toEqual({ via: 'target' });
    expect(seen.some((url) => url.endsWith('/x'))).toBe(false);
  });
});
