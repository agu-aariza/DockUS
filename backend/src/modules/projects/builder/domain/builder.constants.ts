export const BUILDER_RUNS_QUEUE_NAME = 'builder-runs';
export const BUILDER_RUN_JOB_NAME = 'execute-build-run';

export const DEFAULT_DOCKER_BUILD_TIMEOUT_MS = 300000;
export const DEFAULT_DOCKER_CHECK_TIMEOUT_MS = 15000;
export const DEFAULT_BUILDER_CLEANUP_IMAGES = true;
export const DEFAULT_SELF_HEAL_MAX_ATTEMPTS = 3;
export const DEFAULT_IMAGE_TTL_MS = 1800000;
export const DEFAULT_STALE_RUN_THRESHOLD_MS = 600000;
export const DEFAULT_BASE_PYTHON_IMAGE = 'python:3.11.9-slim-bookworm';
export const DEFAULT_MAX_EXTRACTED_FILES = 1500;
export const DEFAULT_MAX_EXTRACTED_BYTES = 100 * 1024 * 1024;

export const DEFAULT_BATCH_TIMEOUT_SECONDS = 60;
export const DEFAULT_SERVICE_READY_TIMEOUT_SECONDS = 90;
export const DEFAULT_STABILITY_WINDOW_SECONDS = 30;
export const DEFAULT_EXECUTION_NETWORK_PREFIX = 'dockus-run';
export const DEFAULT_DOCKER_RUNTIME = 'runc';

export const DEFAULT_BATCH_CPU_LIMIT = '0.5';
export const DEFAULT_BATCH_MEMORY_LIMIT = '512m';

export const DEFAULT_SERVICE_CPU_LIMIT = '0.7';
export const DEFAULT_SERVICE_MEMORY_LIMIT = '768m';

export const DEFAULT_TEST_CPU_LIMIT = '0.3';
export const DEFAULT_TEST_MEMORY_LIMIT = '384m';

export const TEXT_SCAN_EXTENSIONS = new Set([
  '.py',
  '.txt',
  '.md',
  '.json',
  '.yml',
  '.yaml',
  '.toml',
  '.ini',
  '.cfg',
  '.env',
]);

export const ABSOLUTE_PATH_PATTERNS = [
  /[A-Za-z]:[\\/][^\s'"`]+/g,
  /\/Users\/[^\s'"`]+/g,
  /\/home\/[^\s'"`]+/g,
  /\/mnt\/[A-Za-z]\/[^\s'"`]+/g,
];

export const SECRET_PATTERNS: Array<{ id: string; regex: RegExp }> = [
  {
    id: 'SEC_HARDCODED_SECRET',
    regex:
      /\b(secret|api[_-]?key|token|password)\b\s*[:=]\s*["'][^"']{8,}["']/i,
  },
];

export const DEBUG_PATTERNS: Array<{ id: string; regex: RegExp }> = [
  {
    id: 'SEC_DEBUG_MODE',
    regex:
      /\b(DEBUG\s*=\s*True|debug\s*=\s*True|FLASK_ENV\s*=\s*["']development["'])\b/i,
  },
];

export const HARDCODED_PORT_PATTERNS: RegExp[] = [
  /\bport\s*=\s*(\d{2,5})/i,
  /0\.0\.0\.0:(\d{2,5})/,
  /\blisten\(\s*(\d{2,5})/i,
];

export const LOCAL_FILE_ACCESS_PATTERNS: RegExp[] = [
  /\bopen\(\s*["']\/(home|Users)\//,
  /\bPath\(\s*["']\/(home|Users)\//,
];

export const TEST_DISCOVERY_PATTERNS = [
  /^tests\//,
  /(^|\/)test_.*\.py$/i,
  /(^|\/).*_test\.py$/i,
];
