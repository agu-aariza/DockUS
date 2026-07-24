/**
 * @fileoverview Panel y vista del espacio del alumno (StudentRecordSection).
 *
 * @module StudentRecordSection
 */

import { useEffect, useState } from "react";
import { PageHeader } from "../shared/components/ui/PageHeader";
import { SkeletonCard } from "../shared/components/Skeleton";
import { EmptyState } from "../shared/components/EmptyState";
import { studentsApi } from "../shared/api/services";
import { getErrorMessage } from "../shared/utils/errors";
import { StudentProfileView } from "../student-profile/components/StudentProfileView";
import type { StudentProfileResponse } from "../features/students/types";

/**
 * Expediente propio del alumno. El backend lo resuelve desde el token
 * (`/students/me/profile`), así que no hay ningún id que manipular en la URL.
 */
export function StudentRecordSection(): JSX.Element {
  const [profile, setProfile] = useState<StudentProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const data = await studentsApi.myProfile();
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
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mi expediente"
        subtitle="Tus grupos, proyectos, entregas y evaluaciones a lo largo del curso."
      />

      {loading ? (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : error ? (
        <EmptyState
          title="No se pudo cargar tu expediente"
          description={error}
        />
      ) : profile ? (
        <StudentProfileView profile={profile} />
      ) : null}
    </div>
  );
}
