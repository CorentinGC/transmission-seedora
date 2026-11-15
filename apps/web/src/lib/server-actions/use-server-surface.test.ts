import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * c07.15: every export of a `'use server'` module is a public endpoint callable by any client.
 * Pins the exact surface, so a helper such as `readActiveServer` (which returns the decrypted
 * target, password included) can never be exported from one by accident.
 */
const dir = __dirname;
const modules = fs.readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
const exportedNames = (source: string) =>
  [...source.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|var|class|type|interface|enum)\s+(\w+)/gm)]
    .map((m) => m[1])
    .sort();

const EXPECTED: Record<string, string[]> = {
  'geoip.ts': ['geoipLookup'],
  'rpc.ts': ['rpcRequest', 'testServerConnection'],
  'session.ts': ['clearServerCookie', 'setActiveServerCookie'],
};

describe("'use server' modules", () => {
  it('are exactly the known ones', () => {
    expect(modules.sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  for (const file of Object.keys(EXPECTED)) {
    const source = fs.readFileSync(path.join(dir, file), 'utf8');

    it(`${file} starts with the directive and exports only its public actions`, () => {
      expect(source.trimStart().startsWith("'use server'")).toBe(true);
      expect(exportedNames(source)).toEqual(EXPECTED[file]);
    });

    it(`${file} exports only async functions and never re-exports`, () => {
      expect(source).not.toMatch(/^export\s+(?:const|let|var|class|default|\*|\{)/m);
      expect(source).not.toMatch(/^export\s+(?:function)\s/m);
    });
  }

  it('none of them can hand the decrypted target back', () => {
    for (const file of modules) {
      const source = fs.readFileSync(path.join(dir, file), 'utf8');
      expect(source).not.toMatch(/export[^;\n]*(getActiveServerFromCookie|readActiveServer)/);
    }
  });
});
