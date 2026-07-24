import { RiFolderOpenLine } from "react-icons/ri";
import { EmptyState } from "../../shared/components/EmptyState";
import { Button } from "../../shared/components/ui/Button";
import { StudentSurface, StudentSurfaceHeader } from "./StudentWorkspaceSurface";
import type { StudentTab } from "../studentTabs";

interface Props {
  onNavigate: (tab: StudentTab) => void;
}

export function SubmissionEmptyState({ onNavigate }: Props) {
  return (
    <div className="space-y-6">
      <StudentSurface tone="accent">
        <StudentSurfaceHeader
          eyebrow="Nueva entrega"
          title="Aún no tienes prácticas disponibles"
          description="En cuanto el profesorado te asigne una práctica, desde aquí podrás preparar la siguiente versión y seguir el circuito completo de remediación."
          actions={
            <Button variant="secondary" onClick={() => onNavigate("proyectos")}>
              Ver proyectos
            </Button>
          }
        />
      </StudentSurface>
      <EmptyState
        icon={<RiFolderOpenLine className="text-4xl text-slate-400/40" />}
        title="Sin convocatorias activas"
        description="No hay ninguna práctica disponible para subir en este momento. Revisa el resumen o espera a nuevas asignaciones."
      />
    </div>
  );
}
