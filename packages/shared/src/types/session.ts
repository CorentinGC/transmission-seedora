export interface SessionSettings {
  altSpeedDown: number;
  altSpeedEnabled: boolean;
  altSpeedTimeBegin: number;
  altSpeedTimeDay: number;
  altSpeedTimeEnabled: boolean;
  altSpeedTimeEnd: number;
  altSpeedUp: number;
  blocklistEnabled: boolean;
  blocklistSize: number;
  blocklistUrl: string;
  cacheSizeMib: number;
  configDir: string;
  defaultTrackers: string;
  dhtEnabled: boolean;
  downloadDir: string;
  downloadQueueEnabled: boolean;
  downloadQueueSize: number;
  encryption: string;
  idleSeedingLimit: number;
  idleSeedingLimitEnabled: boolean;
  incompleteDir: string;
  incompleteDirEnabled: boolean;
  lpdEnabled: boolean;
  peerLimitGlobal: number;
  peerLimitPerTorrent: number;
  peerPort: number;
  peerPortRandomOnStart: boolean;
  pexEnabled: boolean;
  portForwardingEnabled: boolean;
  queueStalledEnabled: boolean;
  queueStalledMinutes: number;
  renamePartialFiles: boolean;
  rpcVersionSemver: string;
  scriptTorrentAddedEnabled: boolean;
  scriptTorrentAddedFilename: string;
  scriptTorrentDoneEnabled: boolean;
  scriptTorrentDoneFilename: string;
  scriptTorrentDoneSeedingEnabled: boolean;
  scriptTorrentDoneSeedingFilename: string;
  seedQueueEnabled: boolean;
  seedQueueSize: number;
  seedRatioLimit: number;
  seedRatioLimited: boolean;
  sequentialDownload: boolean;
  sessionId: string;
  speedLimitDown: number;
  speedLimitDownEnabled: boolean;
  speedLimitUp: number;
  speedLimitUpEnabled: boolean;
  startAddedTorrents: boolean;
  trashOriginalTorrentFiles: boolean;
  version: string;
  units: SessionUnits;
}

export interface SessionUnits {
  speedUnits: string[];
  speedBytes: number;
  sizeUnits: string[];
  sizeBytes: number;
  memoryUnits: string[];
  memoryBytes: number;
}

export interface SessionStats {
  activeTorrentCount: number;
  downloadSpeed: number;
  pausedTorrentCount: number;
  torrentCount: number;
  uploadSpeed: number;
  cumulativeStats: SessionCumulativeStats;
  currentStats: SessionCumulativeStats;
}

export interface SessionCumulativeStats {
  uploadedBytes: number;
  downloadedBytes: number;
  filesAdded: number;
  sessionCount: number;
  secondsActive: number;
}

export interface FreeSpaceResult {
  path: string;
  'size-bytes': number;
  total_size: number;
}
