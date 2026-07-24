/**
 * @fileoverview Componente de perfil y expediente del alumno (StudentProfilePanel).
 *
 * @module StudentProfilePanel
 */

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { RiArrowLeftLine, RiUser3Line } from "react-icons/ri";
import { PageHeader } from "../shared/components/ui/PageHeader";
import { Button } from "../shared/components/ui/Button";
import { SkeletonCard } from "../shared/components/Skeleton";
import { EmptyState } from "../shared/components/EmptyState";
import { studentsApi } from "../shared/api/services";
import { getErrorMessage } from "../shared/utils/errors";
import { useWorkspaceSelection } from "../shared/workspace/WorkspaceContext";
import { StudentProfileView } from "./components/StudentProfileView";
import type { StudentProfileResponse } from "../features/students/types";

/** Expediente de un alumno visto por el profesor. Ruta: `/students/:studentId`. */
export function StudentProfilePanel(): JSX.Element {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { setDelivery } = useWorkspaceSelection();

  const [profile, setProfile] = useState<StudentProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;
    let active = true;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await studentsApi.profile(studentId);
        if (active) setProfile(data);
      } catch (err) {
        if (active) setError(getErrorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [studentId]);

  // Abrir una entrega desde el expediente lleva al panel de entregas con esa
  // entrega ya seleccionada, en vez de duplicar aquí el estudio de corrección.
  const openDelivery = (deliveryId: string) => {
    setDelivery(deliveryId, "Entrega");
    navigate("/deliveries");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expediente del alumno"
        subtitle="Grupos, proyectos, entregas y ejecuciones a lo largo del curso."
        icon={<RiUser3Line />}
        actions={
          <Button variant="secondary" size="sm" onClick={() => navigate("/users")}>
            <RiArrowLeftLine /> Volver al directorio
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : error ? (
        <EmptyState
          title="No se pudo cargar el expediente"
          description={error}
          actionLabel="Volver al directorio"
          onAction={() => navigate("/users")}
        />
      ) : profile ? (
        <StudentProfileView profile={profile} onOpenDelivery={openDelivery} />
      ) : null}
    </div>
  );
}
