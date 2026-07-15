import type { ChangeEvent } from "react";
import {
  RiCheckFill,
  RiEyeLine,
  RiFileDownloadLine,
  RiFolderUploadLine,
  RiLoader4Line,
} from "react-icons/ri";
import { Button } from "../../shared/components/ui/Button";
import { SectionCard } from "../../shared/components/ui/Layout";
import { formatBytes } from "../../shared/utils/format";
import type { StorageObjectEntity } from "../../shared/types";

export type TestSuiteResult = StorageObjectEntity | { message: string } | null;

export interface ProjectSuiteSectionProps {
  testSuite: TestSuiteResult;
  isUploading: boolean;
  onUpload: (file: File) => void;
  onDownload: () => void;
  onPreview: () => void;
}

export function ProjectSuiteSection({
  testSuite,
  isUploading,
  onUpload,
  onDownload,
  onPreview,
}: ProjectSuiteSectionProps): JSX.Element {
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    onUpload(file);
    if (event.target) event.target.value = "";
  };

  return (
    <SectionCard
      title="Suite de Evaluación Técnica"
      description="Tests automáticos para validar las entregas."
    >
      {testSuite && 'id' in testSuite ? (
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm shadow-emerald-500/20 border border-emerald-400">
              <RiCheckFill className="text-2xl" />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-slate-900">{testSuite.logicalName}</p>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>{formatBytes(testSuite.sizeBytes)}</span>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span>Subido el {new Date(testSuite.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onPreview}
              className="shadow-sm"
            >
              <RiEyeLine />
              Ver tests
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onDownload}
              className="shadow-sm"
            >
              <RiFileDownloadLine />
              Descargar
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={isUploading}
              onClick={() => document.getElementById('suite-upload')?.click()}
              className="shadow-sm"
            >
              <RiFolderUploadLine />
              {isUploading ? "Subiendo..." : "Reemplazar Suite"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-app-border bg-slate-50/60 px-6 py-12 text-center transition-colors hover:border-slate-300">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md border border-app-border bg-white text-slate-400">
            <RiFolderUploadLine className="text-2xl" />
          </div>
          <h5 className="text-sm font-semibold text-slate-900">No hay suite técnica configurada</h5>
          <p className="mt-1 mb-5 max-w-xs text-xs leading-relaxed text-slate-500">
            Para evaluar automáticamente las entregas, sube una suite de tests compatible con <span className="font-semibold text-slate-900">pytest</span>.
          </p>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={isUploading}
            onClick={() => document.getElementById('suite-upload')?.click()}
            className="shadow-sm"
          >
            {isUploading ? (
              <RiLoader4Line className="animate-spin" />
            ) : (
              <RiFolderUploadLine />
            )}
            {isUploading ? "Subiendo archivo..." : "Subir Suite (.zip)"}
          </Button>
        </div>
      )}
      <input
        type="file"
        id="suite-upload"
        className="hidden"
        accept=".zip,.tar.gz"
        onChange={handleFileChange}
      />
    </SectionCard>
  );
}
