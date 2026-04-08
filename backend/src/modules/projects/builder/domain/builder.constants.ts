export const BUILDER_RUNS_QUEUE_NAME = 'builder-runs';
export const BUILDER_RUN_JOB_NAME = 'execute-build-run';

export const DEFAULT_DOCKER_BUILD_TIMEOUT_MS = 300000;
export const DEFAULT_DOCKER_CHECK_TIMEOUT_MS = 15000;
export const DEFAULT_BUILDER_CLEANUP_IMAGES = true;
export const DEFAULT_IMAGE_TTL_MS = 1800000;
export const DEFAULT_STALE_RUN_THRESHOLD_MS = 600000;
export const DEFAULT_PYTHON_VERSION = '3.11';
export const DEFAULT_BASE_PYTHON_IMAGE = 'python:3.11.9-slim-bookworm';
export const DEFAULT_MAX_EXTRACTED_FILES = 1500;
export const DEFAULT_MAX_EXTRACTED_BYTES = 100 * 1024 * 1024;
export const DEFAULT_LOG_TAIL_LINES = 120;

export const DEFAULT_KIND_CLUSTER_NAME = 'dockus-builder';
export const DEFAULT_KUBECTL_TIMEOUT_MS = 90000;
export const DEFAULT_BATCH_TIMEOUT_SECONDS = 60;
export const DEFAULT_SERVICE_READY_TIMEOUT_SECONDS = 90;
export const DEFAULT_STABILITY_WINDOW_SECONDS = 30;
export const DEFAULT_K8S_NAMESPACE_PREFIX = 'dockus-run';

export const DEFAULT_BATCH_CPU_REQUEST = '100m';
export const DEFAULT_BATCH_MEMORY_REQUEST = '128Mi';
export const DEFAULT_BATCH_CPU_LIMIT = '500m';
export const DEFAULT_BATCH_MEMORY_LIMIT = '512Mi';

export const DEFAULT_SERVICE_CPU_REQUEST = '150m';
export const DEFAULT_SERVICE_MEMORY_REQUEST = '192Mi';
export const DEFAULT_SERVICE_CPU_LIMIT = '700m';
export const DEFAULT_SERVICE_MEMORY_LIMIT = '768Mi';

export const DEFAULT_TEST_CPU_REQUEST = '100m';
export const DEFAULT_TEST_MEMORY_REQUEST = '128Mi';
export const DEFAULT_TEST_CPU_LIMIT = '300m';
export const DEFAULT_TEST_MEMORY_LIMIT = '384Mi';

export const CLASSIFIER_VERSION = 'dockus-stable.0';

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
