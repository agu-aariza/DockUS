export const BUILDER_RUNS_QUEUE_NAME = 'builder-runs';
export const BUILDER_RUN_JOB_NAME = 'execute-build-run';

export const DEFAULT_STALE_RUN_THRESHOLD_MS = 600000;
export const DEFAULT_MAX_EXTRACTED_FILES = 1500;
export const DEFAULT_MAX_EXTRACTED_BYTES = 100 * 1024 * 1024;

export const DEFAULT_BASE_PYTHON_IMAGE = 'python:3.11-slim';
export const DEFAULT_BASE_NODE_IMAGE = 'node:20-alpine';

export const ALLOWED_PYTHON_VERSIONS = ['3.8', '3.9', '3.10', '3.11', '3.12'] as const;
export const ALLOWED_NODE_VERSIONS = ['16', '18', '20', '21', '22'] as const;
