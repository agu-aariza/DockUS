export const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';
export const DEFAULT_OLLAMA_MODEL = 'qwen2.5-coder:7b';
export const DEFAULT_OLLAMA_TIMEOUT_MS = 120000;
export const DEFAULT_DOCKER_BUILD_TIMEOUT_MS = 300000;
export const DEFAULT_BUILDER_CLEANUP_IMAGES = true;
export const DEFAULT_PYTHON_VERSION = '3.11';
export const DEFAULT_MAX_EXTRACTED_FILES = 1500;
export const DEFAULT_MAX_EXTRACTED_BYTES = 100 * 1024 * 1024;
export const DEFAULT_DOCKER_CHECK_TIMEOUT_MS = 15000;
export const DEFAULT_PROMPT_MAX_CHARS = 180000;
export const DEFAULT_LOG_TAIL_LINES = 120;

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

export const DOCKERFILE_SYSTEM_PROMPT =
  'Eres un experto en DevOps y Docker para proyectos Python academicos. ' +
  'Tu salida DEBE ser solo el contenido final de un Dockerfile valido. ' +
  'No incluyas markdown, comentarios fuera de Dockerfile ni explicaciones.';

export const QUALITY_SYSTEM_PROMPT =
  'Eres un analizador estricto de calidad orientada a objetos en Python. ' +
  'Responde SOLO JSON valido UTF-8, sin markdown ni texto adicional.';

export const ALLOWED_CONSTRUCTORS = new Set<string>([
  'parametrized',
  'non-parametrized',
  'implicit',
]);
