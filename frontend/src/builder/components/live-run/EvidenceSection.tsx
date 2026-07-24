/**
 * @fileoverview Componente de monitorización de ejecuciones SSE en vivo (EvidenceSection).
 *
 * @module EvidenceSection
 */

import {
  RiDownloadLine,
  RiEyeLine,
  RiEyeOffLine,
  RiLoader4Line,
} from "react-icons/ri";
import type { EvidenceArtifactDto } from "../../../features/builder/types";
import { Button } from "../../../shared/components/ui/Button";
import { StatusBadge } from "../../../shared/components/ui/StatusBadge";
import { formatDate } from "../../utils";
import {
  cn,
  formatArtifactLabel,
  formatBytes,
  isPreviewable,
  prettifyJson,
} from "./liveRunUtils";

export interface PreviewedArtifact {
  id: string;
  type: string;
  contentType: string;
  content: string;
}

interface EvidenceSectionProps {
  isTerminal: boolean;
  emptyMessage: string | null;
  artifacts: EvidenceArtifactDto[];
  loading: boolean;
  error: string | null;
  downloadingArtifactId: string | null;
  previewingArtifact: PreviewedArtifact | null;
  previewLoading: string | null;
  onPreviewArtifact?: (artifactId: string) => void;
  onClosePreview?: () => void;
  onDownloadArtifact?: (artifactId: string) => void;
}

/**
 * Los artefactos del run, en lista densa: un run largo deja decenas de prompts, respuestas
 * brutas e informes, y en tarjetas grandes se vuelven ilegibles. Vive en su propia pestaña
 * para no ensuciar la vista en vivo.
 */
export function EvidenceSection({
  isTerminal,
  emptyMessage,
  artifacts,
  loading,
  error,
  downloadingArtifactId,
  previewingArtifact,
  previewLoading,
  onPreviewArtifact,
  onClosePreview,
  onDownloadArtifact,
}: EvidenceSectionProps): JSX.Element {
  return (
    <section>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Evidencias del run</h3>
          <p className="mt-0.5 text-sm text-slate-500">
            Artefactos persistidos para auditoría del profesorado.
          </p>
        </div>
        <StatusBadge tone={isTerminal ? "idle" : "warning"}>
          {isTerminal ? "Run cerrado" : "Run en progreso"}
        </StatusBadge>
      </div>

      {loading ? (
        <p className="mt-4 rounded-md border border-dashed border-app-border bg-app-bg-subtle px-4 py-8 text-center text-sm text-slate-500">
          Cargando evidencias…
        </p>
      ) : error ? (
        <p className="mt-4 rounded-md border border-danger/30 bg-danger-subtle px-4 py-3 text-sm text-danger">
          No se pudo cargar la lista de evidencias: {error}
        </p>
      ) : artifacts.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-app-border bg-app-bg-subtle px-4 py-8 text-center text-sm text-slate-500">
          {emptyMessage}
        </p>
      ) : (
        <>
          <ul className="mt-4 divide-y divide-app-border rounded-md border border-app-border">
            {artifacts.map((artifact) => (
              <ArtifactRow
                key={artifact.id}
                artifact={artifact}
                previewing={previewingArtifact?.id === artifact.id}
                loadingPreview={previewLoading === artifact.id}
                downloading={downloadingArtifactId === artifact.id}
                onPreview={onPreviewArtifact}
                onDownload={onDownloadArtifact}
              />
            ))}
          </ul>

          {previewingArtifact && (
            <ArtifactPreview
              artifact={previewingArtifact}
              onClose={onClosePreview}
            />
          )}
        </>
      )}
    </section>
  );
}

function ArtifactRow({
  artifact,
  previewing,
  loadingPreview,
  downloading,
  onPreview,
  onDownload,
}: {
  artifact: EvidenceArtifactDto;
  previewing: boolean;
  loadingPreview: boolean;
  downloading: boolean;
  onPreview?: (artifactId: string) => void;
  onDownload?: (artifactId: string) => void;
}): JSX.Element {
  const canPreview = isPreviewable(artifact.contentType);

  return (
    <li
      className={cn(
        "flex flex-col gap-3 px-4 py-3 transition-colors sm:flex-row sm:items-center",
        previewing ? "bg-accent-subtle" : "bg-white hover:bg-app-bg-subtle",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">
          {formatArtifactLabel(artifact.type)}
        </p>
        <p className="data-meta truncate text-slate-400">{artifact.type}</p>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <span className="data-meta w-16 text-right">{formatBytes(artifact.sizeBytes)}</span>
        <span className="data-meta hidden lg:block">{formatDate(artifact.createdAt)}</span>

        <div className="flex items-center gap-1">
          {canPreview && (
            <Button
              variant={previewing ? "primary" : "secondary"}
              size="sm"
              disabled={loadingPreview}
              onClick={() => onPreview?.(artifact.id)}
            >
              {loadingPreview ? (
                <RiLoader4Line className="animate-spin motion-reduce:animate-none" />
              ) : previewing ? (
                <RiEyeOffLine />
              ) : (
                <RiEyeLine />
              )}
              {previewing ? "Ocultar" : "Ver"}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={downloading || typeof onDownload !== "function"}
            onClick={() => onDownload?.(artifact.id)}
          >
            <RiDownloadLine />
            {downloading ? "…" : "Descargar"}
          </Button>
        </div>
      </div>
    </li>
  );
}

function ArtifactPreview({
  artifact,
  onClose,
}: {
  artifact: PreviewedArtifact;
  onClose?: () => void;
}): JSX.Element {
  return (
    <div className="mt-4 overflow-hidden rounded-md border border-app-border bg-slate-950">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="truncate text-sm font-medium text-slate-100">
            {formatArtifactLabel(artifact.type)}
          </span>
          <span className="shrink-0 font-mono text-xs text-slate-500">
            {artifact.contentType}
          </span>
        </div>
        <button
          type="button"
          aria-label="Cerrar previsualización"
          onClick={onClose}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          ×
        </button>
      </div>
      <pre className="custom-scrollbar max-h-[500px] overflow-auto p-4 font-mono text-xs leading-6 text-slate-300 selection:bg-primary/30">
        <code>{prettifyJson(artifact.content, artifact.contentType)}</code>
      </pre>
    </div>
  );
}
