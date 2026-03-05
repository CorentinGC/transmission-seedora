// ── Torrent Status Enum ──

export const TorrentStatus = {
  STOPPED: 0,
  CHECK_WAIT: 1,
  CHECK: 2,
  DOWNLOAD_WAIT: 3,
  DOWNLOAD: 4,
  SEED_WAIT: 5,
  SEED: 6,
} as const;

export type TorrentStatusValue = (typeof TorrentStatus)[keyof typeof TorrentStatus];

// ── Torrent Fields (torrent-get) ──

export const TORRENT_FIELDS = [
  'id',
  'hashString',
  'name',
  'magnetLink',
  'status',
  'error',
  'errorString',
  'isFinished',
  'isStalled',
  'isPrivate',
  // Dates
  'activityDate',
  'addedDate',
  'doneDate',
  'startDate',
  'editDate',
  'dateCreated',
  // Size & Progress
  'totalSize',
  'sizeWhenDone',
  'leftUntilDone',
  'haveValid',
  'haveUnchecked',
  'percentComplete',
  'percentDone',
  'metadataPercentComplete',
  'desiredAvailable',
  'recheckProgress',
  'corruptEver',
  // Download/Upload
  'downloadDir',
  'downloadLimit',
  'downloadLimited',
  'uploadLimit',
  'uploadLimited',
  'uploadRatio',
  'uploadedEver',
  'downloadedEver',
  'rateDownload',
  'rateUpload',
  // Peers
  'peersConnected',
  'peersGettingFromUs',
  'peersSendingToUs',
  'peers',
  'peersFrom',
  'maxConnectedPeers',
  'peerLimit',
  // Trackers
  'trackers',
  'trackerStats',
  'trackerList',
  // Files
  'files',
  'fileStats',
  'fileCount',
  'pieceCount',
  'pieceSize',
  'pieces',
  'availability',
  'priorities',
  'wanted',
  // Bandwidth & Priority
  'bandwidthPriority',
  'honorsSessionLimits',
  'queuePosition',
  // Seeding
  'seedRatioLimit',
  'seedRatioMode',
  'seedIdleLimit',
  'seedIdleMode',
  'secondsDownloading',
  'secondsSeeding',
  // Timing
  'eta',
  'etaIdle',
  // Metadata
  'comment',
  'creator',
  'primaryMimeType',
  // Labels & Group
  'labels',
  'group',
  // Sequential
  'sequentialDownload',
  // Webseeds
  'webseedsSendingToUs',
] as const;

export type TorrentField = (typeof TORRENT_FIELDS)[number];

// Minimal fields for the torrent list (performance)
export const TORRENT_LIST_FIELDS: TorrentField[] = [
  'id',
  'name',
  'status',
  'error',
  'errorString',
  'isFinished',
  'isStalled',
  'isPrivate',
  'totalSize',
  'sizeWhenDone',
  'leftUntilDone',
  'haveValid',
  'percentDone',
  'recheckProgress',
  'rateDownload',
  'rateUpload',
  'uploadRatio',
  'uploadedEver',
  'downloadedEver',
  'eta',
  'peersConnected',
  'peersSendingToUs',
  'peersGettingFromUs',
  'addedDate',
  'doneDate',
  'activityDate',
  'downloadDir',
  'downloadLimit',
  'downloadLimited',
  'uploadLimit',
  'uploadLimited',
  'bandwidthPriority',
  'honorsSessionLimits',
  'queuePosition',
  'peerLimit',
  'labels',
  'trackerStats',
  'seedRatioLimit',
  'seedRatioMode',
  'seedIdleLimit',
  'seedIdleMode',
  'sequentialDownload',
  // Details (GeneralTab)
  'hashString',
  'magnetLink',
  'corruptEver',
  'dateCreated',
  'pieceCount',
  'pieceSize',
  'comment',
  'creator',
  // Extra columns
  'secondsSeeding',
  'secondsDownloading',
  'fileCount',
  'group',
];

// ── Torrent Interfaces ──

export interface Torrent {
  id: number;
  hashString: string;
  name: string;
  magnetLink: string;
  status: TorrentStatusValue;
  error: number;
  errorString: string;
  isFinished: boolean;
  isStalled: boolean;
  isPrivate: boolean;
  activityDate: number;
  addedDate: number;
  doneDate: number;
  startDate: number;
  editDate: number;
  dateCreated: number;
  totalSize: number;
  sizeWhenDone: number;
  leftUntilDone: number;
  haveValid: number;
  haveUnchecked: number;
  percentComplete: number;
  percentDone: number;
  metadataPercentComplete: number;
  desiredAvailable: number;
  recheckProgress: number;
  corruptEver: number;
  downloadDir: string;
  downloadLimit: number;
  downloadLimited: boolean;
  uploadLimit: number;
  uploadLimited: boolean;
  uploadRatio: number;
  uploadedEver: number;
  downloadedEver: number;
  rateDownload: number;
  rateUpload: number;
  peersConnected: number;
  peersGettingFromUs: number;
  peersSendingToUs: number;
  peers: TorrentPeer[];
  peersFrom: PeersFrom;
  maxConnectedPeers: number;
  peerLimit: number;
  trackers: TorrentTracker[];
  trackerStats: TorrentTrackerStats[];
  trackerList: string;
  files: TorrentFile[];
  fileStats: TorrentFileStat[];
  fileCount: number;
  pieceCount: number;
  pieceSize: number;
  pieces: string;
  availability: number[];
  priorities: number[];
  wanted: boolean[];
  bandwidthPriority: number;
  honorsSessionLimits: boolean;
  queuePosition: number;
  seedRatioLimit: number;
  seedRatioMode: number;
  seedIdleLimit: number;
  seedIdleMode: number;
  secondsDownloading: number;
  secondsSeeding: number;
  eta: number;
  etaIdle: number;
  comment: string;
  creator: string;
  primaryMimeType: string;
  labels: string[];
  group: string;
  sequentialDownload: boolean;
  webseedsSendingToUs: number;
}

export interface TorrentPeer {
  address: string;
  clientName: string;
  clientIsChoked: boolean;
  clientIsInterested: boolean;
  flagStr: string;
  isDownloadingFrom: boolean;
  isEncrypted: boolean;
  isIncoming: boolean;
  isUploadingTo: boolean;
  isUTP: boolean;
  peerIsChoked: boolean;
  peerIsInterested: boolean;
  port: number;
  progress: number;
  rateToClient: number;
  rateToPeer: number;
}

export interface PeersFrom {
  fromCache: number;
  fromDht: number;
  fromIncoming: number;
  fromLpd: number;
  fromLtep: number;
  fromPex: number;
  fromTracker: number;
}

export interface TorrentTracker {
  id: number;
  announce: string;
  scrape: string;
  tier: number;
}

export interface TorrentTrackerStats {
  id: number;
  announce: string;
  announceState: number;
  downloadCount: number;
  hasAnnounced: boolean;
  hasScraped: boolean;
  host: string;
  isBackup: boolean;
  lastAnnouncePeerCount: number;
  lastAnnounceResult: string;
  lastAnnounceStartTime: number;
  lastAnnounceSucceeded: boolean;
  lastAnnounceTime: number;
  lastAnnounceTimedOut: boolean;
  lastScrapeResult: string;
  lastScrapeStartTime: number;
  lastScrapeSucceeded: boolean;
  lastScrapeTime: number;
  lastScrapeTimedOut: boolean;
  leecherCount: number;
  nextAnnounceTime: number;
  nextScrapeTime: number;
  scrapeState: number;
  seederCount: number;
  sitename: string;
  tier: number;
}

export interface TorrentFile {
  bytesCompleted: number;
  length: number;
  name: string;
}

export interface TorrentFileStat {
  bytesCompleted: number;
  wanted: boolean;
  priority: number;
}

// ── Torrent Add ──

export interface TorrentAddParams {
  filename?: string;
  metainfo?: string;
  downloadDir?: string;
  labels?: string[];
  paused?: boolean;
  peerLimit?: number;
  bandwidthPriority?: number;
  filesWanted?: number[];
  filesUnwanted?: number[];
  priorityHigh?: number[];
  priorityNormal?: number[];
  priorityLow?: number[];
  sequentialDownload?: boolean;
  cookies?: string;
}

export interface TorrentAddResult {
  'torrent-added'?: { id: number; name: string; hashString: string };
  'torrent-duplicate'?: { id: number; name: string; hashString: string };
}
