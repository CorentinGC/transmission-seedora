import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildAppManifest, createAppRequestHandler, resolveAppPath } from './app-protocol';
import { buildRendererCsp } from './csp';

let base: string;
let root: string;
beforeAll(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'seedora-app-'));
  root = path.join(base, 'root');
  fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(root, 'index.html'), '<html></html>');
  fs.writeFileSync(path.join(root, 'assets', 'a.js'), 'x');
  fs.writeFileSync(path.join(root, 'assets', 'b.css'), 'b');
  fs.writeFileSync(path.join(root, 'notes.txt'), 'n');
  fs.writeFileSync(path.join(base, 'secret.js'), 'secret');
  fs.symlinkSync(path.join(base, 'secret.js'), path.join(root, 'link.js'));
  fs.symlinkSync(base, path.join(root, 'outdir'));
  fs.symlinkSync(path.join(root, 'index.html'), path.join(root, 'alias.js'));
});
afterAll(() => fs.rmSync(base, { recursive: true, force: true }));

const handler = () => createAppRequestHandler(buildAppManifest(root));
const req = (url: string, method = 'GET', h = handler()) => h(new Request(url, { method }));

describe('resolveAppPath', () => {
  const get = (p: string) => resolveAppPath(`app://seedora${p}`);

  it('maps plain paths and the root to manifest keys', () => {
    expect(get('/')).toBe('/index.html');
    expect(get('/assets/a.js?v=1#x')).toBe('/assets/a.js');
    expect(get('/./index.html')).toBe('/index.html');
    expect(get('/../index.html')).toBe('/index.html');
  });

  it('rejects traversal in every encoding', () => {
    for (const p of [
      '/%2e%2e/secret.js',
      '/%2E%2E/secret.js',
      '/assets/%2e%2e/%2e%2e/secret.js',
      '/..%2fsecret.js',
      '/assets%2f..%2f..%2fsecret.js',
      '/%252e%252e/secret.js',
      '/%252e%252e%252fsecret.js',
      '/..%5csecret.js',
      '/..\\secret.js',
      '/assets\\a.js',
      '//secret.js',
      '/assets//a.js',
      '/index.html%00.js',
      '/a%00.js',
      '/%zz.js',
      '/assets/%2fa.js',
    ]) {
      // WHATWG URL parsing folds plain and %2e dot segments into a root-relative path; anything else is refused.
      expect([null, '/secret.js'], p).toContain(get(p));
      expect(req(`app://seedora${p}`).status, p).toBe(404);
    }
  });

  it('rejects other schemes, hosts, credentials, ports and garbage', () => {
    for (const url of [
      'file:///etc/hosts',
      'app://evil/index.html',
      'app://seedora.evil.com/index.html',
      'app://user@seedora/index.html',
      'app://seedora:81/index.html',
      'https://seedora/index.html',
      'nope',
    ]) {
      expect(resolveAppPath(url), url).toBeNull();
    }
  });

  it('caps the pathname length', () => {
    expect(get(`/${'a'.repeat(1000)}.js`)).not.toBeNull();
    expect(get(`/${'a'.repeat(1100)}.js`)).toBeNull();
  });
});

describe('buildAppManifest', () => {
  it('lists allow-listed regular files only, never symlinks', () => {
    expect([...buildAppManifest(root).keys()].sort()).toEqual(['/assets/a.js', '/assets/b.css', '/index.html']);
  });

  it('throws when index.html is missing', () => {
    const empty = fs.mkdtempSync(path.join(base, 'empty-'));
    expect(() => buildAppManifest(empty)).toThrow(/index\.html/);
  });
});

describe('createAppRequestHandler', () => {
  it('serves GET and HEAD with the type of the real extension', async () => {
    const res = req('app://seedora/assets/a.js');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/javascript');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await res.text()).toBe('x');
    expect(req('app://seedora/').headers.get('content-type')).toContain('text/html');
    const head = req('app://seedora/assets/a.js', 'HEAD');
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
  });

  it('refuses other methods and answers 404 without detail', async () => {
    expect(req('app://seedora/index.html', 'POST').status).toBe(405);
    expect(req('app://seedora/index.html', 'DELETE').status).toBe(405);
    const res = req('app://seedora/%2e%2e/secret.js');
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain(base);
  });

  it('404s unknown extensions, directories and escaping symlinks', () => {
    for (const p of [
      '/../secret.js',
      '/assets/../../secret.js',
      '/notes.txt',
      '/missing.js',
      '/assets',
      '/assets/',
      '/link.js',
      '/outdir/secret.js',
    ]) {
      expect(req(`app://seedora${p}`).status, p).toBe(404);
    }
  });

  it('does not serve an in-root symlink alias as JS', () => {
    expect(req('app://seedora/alias.js').status).toBe(404);
  });

  it('404s a file added after the manifest was built', () => {
    const h = handler();
    fs.writeFileSync(path.join(root, 'assets', 'late.js'), 'late');
    expect(req('app://seedora/assets/late.js', 'GET', h).status).toBe(404);
    fs.rmSync(path.join(root, 'assets', 'late.js'));
  });

  it('keeps serving build-time bytes after the file changed on disk', async () => {
    const h = handler();
    fs.writeFileSync(path.join(root, 'assets', 'a.js'), 'tampered');
    expect(await req('app://seedora/assets/a.js', 'GET', h).text()).toBe('x');
    fs.writeFileSync(path.join(root, 'assets', 'a.js'), 'x');
  });

  it('sends the CSP with frame-ancestors on every response, errors included', () => {
    const expected = `${buildRendererCsp(false)}; frame-ancestors 'none'`;
    for (const [url, method] of [
      ['app://seedora/index.html', 'GET'],
      ['app://seedora/index.html', 'HEAD'],
      ['app://seedora/missing.js', 'GET'],
      ['app://seedora/index.html', 'POST'],
    ] as const) {
      expect(req(url, method).headers.get('content-security-policy'), `${method} ${url}`).toBe(expected);
    }
  });
});
