import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const compiledRoot = join(projectRoot, ".tmp-test-dist");
const testsRoot = join(compiledRoot, "tests");

function collectTestFiles(rootDir) {
  const entries = readdirSync(rootDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTestFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".test.js")) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

mkdirSync(compiledRoot, { recursive: true });
writeFileSync(
  join(compiledRoot, "package.json"),
  JSON.stringify({ type: "module" }, null, 2),
);

if (!statSync(testsRoot).isDirectory()) {
  throw new Error(`No se encontro el directorio de tests compilados: ${testsRoot}`);
}

const testFiles = collectTestFiles(testsRoot);
if (testFiles.length === 0) {
  throw new Error("No se encontraron archivos .test.js compilados.");
}

const result = spawnSync(
  process.execPath,
  ["--experimental-specifier-resolution=node", "--test", ...testFiles],
  {
    cwd: projectRoot,
    stdio: "inherit",
  },
);

if (typeof result.status === "number") {
  process.exit(result.status);
}

throw result.error ?? new Error("La ejecucion de los tests no devolvio un estado valido.");
