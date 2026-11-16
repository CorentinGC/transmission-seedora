import http from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * Minimal fake Transmission daemon for the e2e suite: session-id handshake (409), `session-get`,
 * `session-stats`, `torrent-get`, `torrent-add`, `torrent-remove`, `torrent-start`/`-stop`, `free-space`.
 * State is in memory; every request is recorded so specs can assert what the web app sent.
 */

export interface FakeTorrent {
  id: number;
  name: string;
  hashString: string;
  status: number;
  totalSize: number;
  percentDone: number;
}

export interface RecordedRequest {
  method: string;
  args: Record<string, unknown>;
  auth: string | undefined;
}

const SESSION_ID = 'fake-session-id-0001';
const ARRAY_FIELDS = new Set([
  'files',
  'fileStats',
  'peers',
  'trackers',
  'trackerStats',
  'availability',
  'priorities',
  'wanted',
  'labels',
]);
const STRING_FIELDS = new Set([
  'name',
  'hashString',
  'magnetLink',
  'errorString',
  'downloadDir',
  'comment',
  'creator',
  'trackerList',
  'pieces',
  'primaryMimeType',
  'group',
]);

function torrentFields(t: FakeTorrent, fields: string[]): Record<string, unknown> {
  const known: Record<string, unknown> = {
    id: t.id,
    name: t.name,
    hashString: t.hashString,
    status: t.status,
    totalSize: t.totalSize,
    sizeWhenDone: t.totalSize,
    percentDone: t.percentDone,
    percentComplete: t.percentDone,
    leftUntilDone: Math.round(t.totalSize * (1 - t.percentDone)),
    downloadDir: '/downloads',
    addedDate: 1_700_000_000,
    eta: -1,
    etaIdle: -1,
    uploadRatio: 0,
    peersFrom: {},
    trackerStats: [],
    fileCount: 1,
    pieceCount: 1,
    pieceSize: t.totalSize,
    queuePosition: t.id,
    metadataPercentComplete: 1,
    bandwidthPriority: 0,
    honorsSessionLimits: true,
    isPrivate: false,
    isFinished: false,
    isStalled: false,
  };
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in known) out[field] = known[field];
    else if (ARRAY_FIELDS.has(field)) out[field] = [];
    else if (STRING_FIELDS.has(field)) out[field] = '';
    else out[field] = 0;
  }
  return out;
}

const SESSION = {
  'alt-speed-down': 50,
  'alt-speed-enabled': false,
  'alt-speed-up': 50,
  'download-dir': '/downloads',
  'download-queue-enabled': true,
  'download-queue-size': 5,
  'peer-port': 51413,
  'rpc-version': 18,
  'rpc-version-semver': '5.3.0',
  'seed-queue-enabled': false,
  'seed-queue-size': 10,
  'session-id': SESSION_ID,
  'speed-limit-down': 100,
  'speed-limit-down-enabled': false,
  'speed-limit-up': 100,
  'speed-limit-up-enabled': false,
  'start-added-torrents': true,
  version: '4.0.6 (fake)',
  units: {
    'speed-units': ['kB/s', 'MB/s', 'GB/s', 'TB/s'],
    'speed-bytes': 1000,
    'size-units': ['kB', 'MB', 'GB', 'TB', 'PB', 'EB'],
    'size-bytes': 1000,
    'memory-units': ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB'],
    'memory-bytes': 1024,
  },
};

export interface FakeTransmission {
  port: number;
  torrents: FakeTorrent[];
  requests: RecordedRequest[];
  close(): Promise<void>;
}

/** Starts the fake daemon on 127.0.0.1 (random port unless given). */
export async function startFakeTransmission(
  initial: Array<Partial<FakeTorrent> & { name: string }> = [],
  port = 0,
): Promise<FakeTransmission> {
  let nextId = 1;
  const make = (partial: Partial<FakeTorrent> & { name: string }): FakeTorrent => {
    const id = nextId++;
    return {
      id,
      hashString: id.toString(16).padStart(40, '0'),
      status: 4,
      totalSize: 1_000_000,
      percentDone: 0.5,
      ...partial,
    };
  };
  const torrents = initial.map(make);
  const requests: RecordedRequest[] = [];

  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      if (req.headers['x-transmission-session-id'] !== SESSION_ID) {
        res.writeHead(409, { 'X-Transmission-Session-Id': SESSION_ID }).end('409: Conflict');
        return;
      }
      let body: { method?: string; arguments?: Record<string, unknown> };
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        res.writeHead(400).end('bad json');
        return;
      }
      const args = body.arguments ?? {};
      const method = body.method ?? '';
      requests.push({ method, args, auth: req.headers.authorization });
      const ids = Array.isArray(args.ids) ? (args.ids as number[]) : null;
      let result: Record<string, unknown> = {};
      switch (method) {
        case 'session-get':
          result = SESSION;
          break;
        case 'session-stats':
          result = {
            activeTorrentCount: torrents.length,
            downloadSpeed: 0,
            pausedTorrentCount: 0,
            torrentCount: torrents.length,
            uploadSpeed: 0,
            'cumulative-stats': {
              uploadedBytes: 0,
              downloadedBytes: 0,
              filesAdded: 0,
              secondsActive: 0,
              sessionCount: 1,
            },
            'current-stats': { uploadedBytes: 0, downloadedBytes: 0, filesAdded: 0, secondsActive: 0, sessionCount: 1 },
          };
          break;
        case 'torrent-get': {
          const fields = (args.fields as string[] | undefined) ?? ['id'];
          const list = ids ? torrents.filter((t) => ids.includes(t.id)) : torrents;
          result = { torrents: list.map((t) => torrentFields(t, fields)) };
          break;
        }
        case 'torrent-add': {
          const source = String(args.filename ?? 'uploaded.torrent');
          const added = make({
            name: source.startsWith('magnet:')
              ? decodeURIComponent(/dn=([^&]+)/.exec(source)?.[1] ?? 'magnet')
              : source,
            percentDone: 0,
          });
          torrents.push(added);
          result = { 'torrent-added': { id: added.id, name: added.name, hashString: added.hashString } };
          break;
        }
        case 'torrent-remove':
          for (const id of ids ?? []) {
            const index = torrents.findIndex((t) => t.id === id);
            if (index >= 0) torrents.splice(index, 1);
          }
          break;
        case 'torrent-start':
        case 'torrent-start-now':
        case 'torrent-stop':
          for (const t of torrents) if (!ids || ids.includes(t.id)) t.status = method === 'torrent-stop' ? 0 : 4;
          break;
        case 'free-space':
          result = { path: String(args.path ?? '/'), 'size-bytes': 1e12, total_size: 2e12 };
          break;
        default:
          break;
      }
      res
        .writeHead(200, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ result: 'success', arguments: result }));
    });
  });

  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  return {
    port: (server.address() as AddressInfo).port,
    torrents,
    requests,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

/** Run directly (`node fake-transmission.ts`), serves a fixed-port daemon for the Playwright `webServer` entry. */
if (process.argv[1]?.endsWith('fake-transmission.ts')) {
  const daemonPort = Number(process.env.FAKE_DAEMON_PORT ?? 19091);
  void startFakeTransmission(
    [
      { name: 'ubuntu-24.04-desktop-amd64.iso', totalSize: 6_000_000_000, percentDone: 0.42 },
      { name: 'Sintel 2010 (4K) 🎬', totalSize: 450_000_000, percentDone: 1, status: 6 },
    ],
    daemonPort,
  ).then((daemon) => {
    console.log(`fake transmission listening on ${daemon.port}`);
    const stop = () => void daemon.close().then(() => process.exit(0));
    process.on('SIGTERM', stop);
    process.on('SIGINT', stop);
  });
}
