import { useEffect, useState } from "react";
import { groupsApi, usersApi } from "../../shared/api/services";
import type { CourseGroupEntity, GroupEnrollmentEntity } from "../../features/groups/types";
import type { UserEntity } from "../../features/auth/types";
import { getErrorMessage } from "../../shared/utils/errors";
import { normalizeOptionalText } from "../../projects/hooks/projectManagement.utils";

export function useGroupManagement(canWrite: boolean) {
  const [groups, setGroups] = useState<CourseGroupEntity[]>([]);
  const [focusedGroupId, setFocusedGroupId] = useState("");
  const [groupEnrollments, setGroupEnrollments] = useState<GroupEnrollmentEntity[] | null>(null);
  const [allStudents, setAllStudents] = useState<UserEntity[]>([]);
  
  const [groupForm, setGroupForm] = useState({
    name: "",
    code: "",
    description: "",
  });
  
  const [bulkInput, setBulkInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: "info" | "warning" } | null>(null);

  const refreshGroups = async () => {
    if (!canWrite) return;
    setLoading(true);
    try {
      const response = await groupsApi.list();
      setGroups(response);
      if (!focusedGroupId && response.length > 0) {
        setFocusedGroupId(response[0].id);
      }
    } catch (error) {
      setNotice({ text: getErrorMessage(error), tone: "warning" });
    } finally {
      setLoading(false);
    }
  };

  const refreshEnrollments = async (groupId: string) => {
    if (!canWrite || !groupId) return;
    try {
      const response = await groupsApi.listEnrollments(groupId);
      setGroupEnrollments(response);
    } catch (error) {
      setNotice({ text: getErrorMessage(error), tone: "warning" });
    }
  };

  const refreshStudents = async () => {
    try {
      setLoading(true);
      console.log("[DockUS-DEBUG] Iniciando carga de alumnos (role=STUDENT)...");
      
      const response = await usersApi.list({ role: "STUDENT", limit: 50 });
      
      console.log("[DockUS-DEBUG] Respuesta recibida:", {
        dataLength: response.data?.length,
        hasMeta: !!response.meta,
        firstItem: response.data?.[0]
      });

      setAllStudents(response.data || []);
    } catch (error: any) {
      console.error("[DockUS-DEBUG] ERROR CRÍTICO AL CARGAR ALUMNOS:", {
        message: error.message,
        status: error.statusCode || error.response?.status,
        apiMessage: error.message,
        stack: error.stack
      });
      
      // Mantenemos la notificación para que el usuario sepa que falló, 
      // pero con más detalle si está disponible.
      setNotice({ 
        text: `Error de API (${error.statusCode || error.response?.status || 'Red'}): No se pudieron cargar los alumnos.`, 
        tone: "warning" 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!canWrite || !groupForm.name.trim()) return;
    setBusy("create");
    try {
      const response = await groupsApi.create({
        name: groupForm.name.trim(),
        code: normalizeOptionalText(groupForm.code),
        description: normalizeOptionalText(groupForm.description),
      });
      setGroupForm({ name: "", code: "", description: "" });
      setNotice({ text: `Grupo "${response.name}" creado.`, tone: "info" });
      await refreshGroups();
      setFocusedGroupId(response.id);
    } catch (error) {
      setNotice({ text: getErrorMessage(error), tone: "warning" });
    } finally {
      setBusy(null);
    }
  };

  const handleUpdateGroup = async (groupId: string, data: Partial<typeof groupForm>) => {
    if (!canWrite) return;
    setBusy(`update:${groupId}`);
    try {
      await groupsApi.update(groupId, data);
      setNotice({ text: "Grupo actualizado correctamente.", tone: "info" });
      await refreshGroups();
    } catch (error) {
      setNotice({ text: getErrorMessage(error), tone: "warning" });
    } finally {
      setBusy(null);
    }
  };

  const handleEnrollStudents = async () => {
    if (!canWrite || !focusedGroupId || !bulkInput.trim()) return;
    
    setBusy("enroll");
    try {
      const response = await groupsApi.bulkEnroll(focusedGroupId, {
        rawInput: bulkInput.trim(),
      });
      setBulkInput("");
      
      const enrolled = response.summary.enrolledCount + response.summary.reactivatedCount;
      const unresolved = (response.summary.unresolvedEmails?.length || 0) + (response.summary.unresolvedNames?.length || 0);
      
      setNotice({ 
        text: `Procesamiento completado. ${enrolled} matriculados correctamente. ${unresolved > 0 ? `${unresolved} registros no procesados.` : ''}`, 
        tone: unresolved > 0 ? "warning" : "info" 
      });
      await refreshEnrollments(focusedGroupId);
      await refreshGroups();
    } catch (error) {
      setNotice({ text: getErrorMessage(error), tone: "warning" });
    } finally {
      setBusy(null);
    }
  };

  const handleToggleEnrollment = async (studentId: string, isEnrolled: boolean) => {
    if (!canWrite || !focusedGroupId) return;
    
    if (isEnrolled) {
      // Find the enrollment ID to revoke
      const enrollment = groupEnrollments?.find(e => e.studentId === studentId && !e.revokedAt);
      if (enrollment) {
        await handleRevokeEnrollment(enrollment.id);
      }
    } else {
      // Enroll
      setBusy(`enroll:${studentId}`);
      try {
        await groupsApi.bulkEnroll(focusedGroupId, { studentIds: [studentId] });
        setNotice({ text: "Alumno matriculado.", tone: "info" });
        await refreshEnrollments(focusedGroupId);
        await refreshGroups();
      } catch (error) {
        setNotice({ text: getErrorMessage(error), tone: "warning" });
      } finally {
        setBusy(null);
      }
    }
  };

  const handleRevokeEnrollment = async (enrollmentId: string) => {
    if (!canWrite || !focusedGroupId) return;
    setBusy(`revoke:${enrollmentId}`);
    try {
      await groupsApi.revokeEnrollment(enrollmentId);
      setNotice({ text: "Alumno retirado del grupo.", tone: "info" });
      await refreshEnrollments(focusedGroupId);
      await refreshGroups();
    } catch (error) {
      setNotice({ text: getErrorMessage(error), tone: "warning" });
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!canWrite) return;
    setBusy(`delete:${groupId}`);
    try {
      await groupsApi.remove(groupId);
      setNotice({ text: "Grupo eliminado correctamente.", tone: "info" });
      await refreshGroups();
      setFocusedGroupId("");
    } catch (error) {
      setNotice({ text: getErrorMessage(error), tone: "warning" });
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    if (canWrite) {
      refreshGroups();
      refreshStudents();
    }
  }, [canWrite]);

  useEffect(() => {
    if (focusedGroupId) {
      refreshEnrollments(focusedGroupId);
    } else {
      setGroupEnrollments(null);
    }
  }, [focusedGroupId]);

  return {
    groups,
    focusedGroupId,
    setFocusedGroupId,
    groupEnrollments,
    allStudents,
    groupForm,
    setGroupForm,
    bulkInput,
    setBulkInput,
    loading,
    busy,
    notice,
    setNotice,
    refreshGroups,
    handleCreateGroup,
    handleUpdateGroup,
    handleEnrollStudents,
    handleToggleEnrollment,
    handleRevokeEnrollment,
    refreshStudents,
    handleDeleteGroup,
  };
}
