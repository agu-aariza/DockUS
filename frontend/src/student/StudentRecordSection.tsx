/**
 * @fileoverview Panel y vista del espacio del alumno (StudentRecordSection).
 *
 * @module StudentRecordSection
 */

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../shared/components/ui/PageHeader";
import { SkeletonCard } from "../shared/components/Skeleton";
import { EmptyState } from "../shared/components/EmptyState";
import { studentsApi } from "../shared/api/services";
import { getErrorMessage } from "../shared/utils/errors";
import { queryKeys } from "../shared/query/queryKeys";
import { StudentProfileView } from "../student-profile/components/StudentProfileView";

/**
 * Expediente propio del alumno. El backend lo resuelve desde el token
 * (`/students/me/profile`), así que no hay ningún id que manipular en la URL.
 */
export function StudentRecordSection(): JSX.Element {
  const profileQuery = useQuery({
    queryKey: queryKeys.studentProfile.mine(),
    queryFn: () => studentsApi.myProfile(),
  });
  const profile = profileQuery.data ?? null;
  const loading = profileQuery.isPending;
  const error = profileQuery.isError ? getErrorMessage(profileQuery.error) : null;

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
