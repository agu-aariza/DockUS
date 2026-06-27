import { RiFolderOpenLine } from "react-icons/ri";
import { EmptyState } from "../../shared/components/EmptyState";
import { Button } from "../../shared/components/ui/Button";
import { StudentSurface, StudentSurfaceHeader } from "./StudentWorkspaceSurface";

interface Props {
  onNavigate: (tab: any) => void;
}

export function SubmissionEmptyState({ onNavigate }: Props) {
  return (
    <div className="space-y-6">
      <StudentSurface tone="accent">
        <StudentSurfaceHeader
          eyebrow="Nueva entrega"
          title="Aun no tienes practicas disponibles"
          description="En cuanto el profesorado te asigne una practica, desde aqui podras preparar la siguiente version y seguir el circuito completo de remediacion."
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
        description="No hay ninguna practica disponible para subir en este momento. Revisa el resumen o espera a nuevas asignaciones."
      />
    </div>
  );
}
