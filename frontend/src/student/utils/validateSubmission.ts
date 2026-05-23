export interface SubmissionPreviewFile {
  path: string;
  sizeBytes: number;
  content?: string | null;
}

export interface SubmissionValidationWarning {
  code: string;
  message: string;
}

export interface SubmissionPreviewDiff {
  added: string[];
  removed: string[];
  persisted: string[];
}

export interface SubmissionValidationResult {
  warnings: SubmissionValidationWarning[];
  diff: SubmissionPreviewDiff;
  totalFiles: number;
  totalSizeBytes: number;
}

function normalizePath(path: string): string {
  return path.replace(/^\.?\//, "").replace(/\\/g, "/");
}

function hasPath(files: SubmissionPreviewFile[], matcher: RegExp): boolean {
  return files.some((file) => matcher.test(normalizePath(file.path)));
}

function detectFamily(expectedType?: string | null): "python" | "c" | "generic" {
  const normalized = expectedType?.trim().toUpperCase() ?? "";

  if (normalized.includes("PYTHON")) {
    return "python";
  }

  if (normalized.includes("C_") || normalized === "CLI" || normalized.startsWith("C")) {
    return "c";
  }

  return "generic";
}

function buildSubmissionDiff(
  currentFiles: SubmissionPreviewFile[],
  previousFiles: Array<{ path: string }>,
): SubmissionPreviewDiff {
  const current = new Set(currentFiles.map((file) => normalizePath(file.path)));
  const previous = new Set(previousFiles.map((file) => normalizePath(file.path)));

  const added = [...current].filter((path) => !previous.has(path)).sort();
  const removed = [...previous].filter((path) => !current.has(path)).sort();
  const persisted = [...current].filter((path) => previous.has(path)).sort();

  return { added, removed, persisted };
}

export function validateSubmissionPreview(input: {
  expectedType?: string | null;
  files: SubmissionPreviewFile[];
  previousFiles?: Array<{ path: string }>;
}): SubmissionValidationResult {
  const files = input.files.map((file) => ({
    ...file,
    path: normalizePath(file.path),
  }));
  const warnings: SubmissionValidationWarning[] = [];
  const family = detectFamily(input.expectedType);

  if (files.length === 0) {
    warnings.push({
      code: "empty_archive",
      message: "El archivo comprimido no contiene ficheros legibles.",
    });
  }

  if (family === "python" && !hasPath(files, /(^|\/)(main\.py|app\.py|__main__\.py)$/i)) {
    warnings.push({
      code: "missing_python_entrypoint",
      message:
        "Detectamos que tu entrega no contiene `main.py`, `app.py` ni `__main__.py`. Comprueba que el punto de entrada correcto este dentro del ZIP.",
    });
  }

  if (family === "c" && !hasPath(files, /\.c$/i)) {
    warnings.push({
      code: "missing_c_sources",
      message:
        "No hemos encontrado archivos `.c` en el comprimido. Revisa si has exportado la carpeta correcta.",
    });
  }

  if (family === "c" && !hasPath(files, /(^|\/)makefile$/i)) {
    warnings.push({
      code: "missing_makefile",
      message:
        "No se ha detectado `Makefile`. Si la rubrica pide compilar con `make`, revisa que lo hayas incluido.",
    });
  }

  const diff = buildSubmissionDiff(files, input.previousFiles ?? []);

  return {
    warnings,
    diff,
    totalFiles: files.length,
    totalSizeBytes: files.reduce((total, file) => total + file.sizeBytes, 0),
  };
}
