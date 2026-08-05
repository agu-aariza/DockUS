/**
 * Lanza Jest con un directorio temporal estable para que las suites del
 * backend compartan una configuración no interactiva y aislada de la caché.
 */
const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');

function resolveTempDirectory() {
  if (process.platform !== 'win32') {
    return '/tmp';
  }

  const candidate =
    process.env.TMPDIR ||
    process.env.TMP ||
    process.env.TEMP ||
    (process.platform === 'win32' ? 'C:\\Windows\\Temp' : '/tmp');
  return candidate && existsSync(candidate) ? candidate : 'C:\\Windows\\Temp';
}

const tempDirectory = resolveTempDirectory();
const cacheDirectory = `${tempDirectory.replace(/[\\\/]+$/, '')}/educodeai-jest-cache`;
const env = {
  ...process.env,
  TMPDIR: tempDirectory,
  TMP: process.env.TMP || tempDirectory,
  TEMP: process.env.TEMP || tempDirectory,
};

const forwardedArgs = process.argv.slice(2);
const hasCacheDirectoryOverride = forwardedArgs.includes('--cacheDirectory');
const jestArgs = [
  require.resolve('jest/bin/jest'),
  ...(hasCacheDirectoryOverride
    ? []
    : ['--cacheDirectory', cacheDirectory]),
  ...forwardedArgs,
];

const result = spawnSync(
  process.execPath,
  jestArgs,
  {
    env,
    stdio: 'inherit',
  },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
