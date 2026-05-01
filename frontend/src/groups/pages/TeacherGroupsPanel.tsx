import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { 
  RiGroupLine, 
  RiAddLine, 
  RiDeleteBinLine, 
  RiArrowRightSLine, 
  RiUser3Fill, 
  RiCheckFill,
  RiInformationFill,
  RiRefreshLine,
  RiSearchLine,
  RiFilter3Line,
  RiArrowLeftRightLine,
  RiTeamFill,
  RiSettings4Fill,
  RiMore2Fill,
  RiEditLine
} from "react-icons/ri";
import { useGroupManagement } from "../hooks/useGroupManagement";
import { UserEntity } from "../../shared/types";
import { EmptyState } from "../../shared/components/EmptyState";
import { useNoticeToasts } from "../../shared/toast/useNoticeToasts";
import { PageHeader } from "../../shared/components/ui/PageHeader";
import { Button } from "../../shared/components/ui/Button";
import { Tabs } from "../../shared/components/ui/Tabs";

export function TeacherGroupsPanel({ session }: { session: any }) {
  const canWrite = ["TEACHER", "ADMIN"].includes(session.role);
  const location = useLocation();
  const {
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
    handleCreateGroup,
    handleUpdateGroup,
    handleEnrollStudents,
    handleToggleEnrollment,
    refreshGroups,
    refreshStudents,
    handleDeleteGroup
  } = useGroupManagement(canWrite);

  // Deep linking: focus group from URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const gId = params.get('focusedGroupId');
    if (gId && gId !== focusedGroupId) {
      setFocusedGroupId(gId);
    }
  }, [location.search, focusedGroupId, setFocusedGroupId]);

  // Ensure groups and students are loaded
  useEffect(() => {
    refreshGroups();
    refreshStudents();
  }, []);

  const [studentSearch, setStudentSearch] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [enrollmentFilter, setEnrollmentFilter] = useState<"all" | "enrolled" | "not_enrolled">("all");

  const filteredGroups = groups.filter(g => 
    !groupSearch.trim() || 
    g.name.toLowerCase().includes(groupSearch.toLowerCase()) || 
    g.code?.toLowerCase().includes(groupSearch.toLowerCase())
  );

  useNoticeToasts([notice], "Gestión de Grupos");

  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", code: "", description: "" });
  const focusedGroup = groups.find(g => g.id === focusedGroupId);

  const openEditModal = () => {
    if (!focusedGroup) return;
    setEditForm({
      name: focusedGroup.name,
      code: focusedGroup.code || "",
      description: focusedGroup.description || "",
    });
    setIsEditing(true);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 w-full max-w-full overflow-x-hidden">
      <PageHeader 
        title="Gestión de Grupos"
        subtitle="Gestión estratégica de cohortes, control de matriculaciones y orquestación de grupos académicos."
        icon={<RiTeamFill />}
        badge={groups.length.toString()}
        actions={
          canWrite && (
            <Button 
              variant="primary"
              className="lg:mt-4"
              onClick={() => setIsCreating(true)}
            >
              <RiAddLine /> Nuevo Grupo
            </Button>
          )
        }
      />
        <div className="flex items-center gap-2">
           <Button 
              variant="secondary"
             className="h-11 px-4 flex items-center justify-center rounded-xl"
              onClick={refreshGroups}
             disabled={loading}
              title="Refrescar datos"
            >
             <RiRefreshLine className={loading ? "animate-spin" : ""} />
             <span>{loading ? "Actualizando..." : "Actualizar grupos"}</span>
            </Button>
        </div>

      <div className="grid gap-8 lg:grid-cols-[380px_1fr] items-start relative max-w-full">
        {/* Sidebar: Group Selection & Creation */}
        <aside className="space-y-6 lg:sticky lg:top-32 max-h-[calc(100vh-140px)] overflow-y-auto overflow-x-hidden no-scrollbar pb-10">
          {isCreating && (
            <div className="p-6 rounded-[2.5rem] border border-brand-maroon/10 bg-brand-maroon/5 space-y-4 animate-in zoom-in-95 shadow-sm">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-widest text-brand-maroon">Crear Nuevo Grupo</h4>
                <button onClick={() => setIsCreating(false)} className="text-brand-maroon/40 hover:text-brand-maroon">×</button>
              </div>
              <div className="space-y-3">
                <input 
                  className="w-full h-12 px-4 rounded-2xl bg-white border border-brand-maroon/10 focus:border-brand-maroon focus:ring-4 focus:ring-brand-maroon/5 transition-all text-sm font-medium" 
                  placeholder="Nombre del grupo (ej: 2º DAW)"
                  value={groupForm.name}
                  onChange={(e) => setGroupForm(prev => ({ ...prev, name: e.target.value }))}
                />
                <input 
                  className="w-full h-12 px-4 rounded-2xl bg-white border border-brand-maroon/10 focus:border-brand-maroon focus:ring-4 focus:ring-brand-maroon/5 transition-all text-sm font-medium" 
                  placeholder="Código corto (ej: DAW-24)"
                  value={groupForm.code}
                  onChange={(e) => setGroupForm(prev => ({ ...prev, code: e.target.value }))}
                />
                <Button 
                  variant="primary"
                  className="w-full !h-12 shadow-none"
                  disabled={!groupForm.name || !!busy}
                  onClick={async () => {
                    await handleCreateGroup();
                    setIsCreating(false);
                  }}
                >
                  {busy === "create" ? "Generando..." : "Confirmar Creación"}
                </Button>
              </div>
            </div>
          )}
          
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm mb-6 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 opacity-[0.03] text-7xl text-slate-900 pointer-events-none group-hover:scale-110 transition-transform duration-700">
              <RiSearchLine />
            </div>
            <h4 className="eyebrow mb-4">Explorar Grupos</h4>
            <div className="relative">
              <RiSearchLine className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-maroon transition-colors" />
              <input 
                className="w-full h-12 pl-11 pr-4 rounded-2xl bg-slate-50 border-transparent focus:bg-white focus:border-brand-maroon/20 focus:ring-4 focus:ring-brand-maroon/5 transition-all text-sm font-medium" 
                placeholder="Buscar grupo o código..."
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
              />
            </div>
          </div>
          
          <div className="space-y-3">
            {filteredGroups.map((group) => (
              <button
                key={group.id}
                className={`w-full flex items-center justify-between p-5 rounded-[2rem] border transition-all duration-300 group overflow-hidden ${
                  focusedGroupId === group.id
                    ? 'border-brand-maroon bg-brand-maroon text-white shadow-[0_20px_50px_-12px_rgba(114,14,35,0.3)] z-10'
                    : 'border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50 hover:shadow-md active:scale-95'
                }`}
                onClick={() => setFocusedGroupId(group.id)}
              >
                <div className="flex items-center gap-4">
                  <div className={`h-12 w-12 rounded-2xl flex items-center justify-center text-xl transition-all duration-500 ${
                    focusedGroupId === group.id ? 'bg-white/10 text-white shadow-inner' : 'bg-slate-50 text-slate-400 group-hover:bg-white group-hover:text-brand-maroon group-hover:scale-110'
                  }`}>
                    <RiGroupLine />
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-sm font-bold truncate leading-none tracking-tight">{group.name}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded transition-colors ${
                        focusedGroupId === group.id ? 'bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {group.code || 'DOC'}
                      </span>
                      <span className={`text-[10px] font-bold ${focusedGroupId === group.id ? 'text-slate-400' : 'text-slate-400'}`}>
                        {group.studentCount} Alumnos
                      </span>
                    </div>
                  </div>
                </div>
                <RiArrowRightSLine className={`text-xl transition-transform duration-300 ${
                  focusedGroupId === group.id ? 'text-white/40 translate-x-1' : 'text-slate-200 group-hover:text-slate-400 translate-x-0 group-hover:translate-x-1'
                }`} />
              </button>
            ))}
            
            {filteredGroups.length === 0 && !loading && (
               <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-[3rem] bg-slate-50/50 animate-in fade-in zoom-in-95">
                  <RiGroupLine className="mx-auto text-5xl text-slate-100 mb-4" />
                  <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">No hay resultados</p>
                  <button 
                    onClick={() => { setGroupSearch(""); setIsCreating(true); }}
                    className="mt-4 text-xs font-bold text-brand-maroon uppercase tracking-widest hover:text-brand-maroon-dark hover:underline"
                  >
                    {groups.length === 0 ? "Crear el primero ahora" : "Limpiar búsqueda"}
                  </button>
               </div>
            )}
          </div>
        </aside>

        {/* Main Content: Enrollment Management */}
        <section className="space-y-6">
          {focusedGroup ? (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
              {/* Focused Group Header Card */}
              <div className="relative overflow-hidden p-8 sm:p-10 rounded-[3rem] bg-white border border-slate-200 shadow-sm">
                <div className="absolute top-0 right-0 p-12 opacity-[0.03] text-[15rem] text-slate-900 pointer-events-none rotate-12">
                   <RiGroupLine />
                </div>
                
                <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div>
                    <span className="eyebrow text-brand-gold mb-4 block">Perfil Operativo del Grupo</span>
                    <h3 className="text-4xl font-bold text-slate-900 tracking-tight">{focusedGroup.name}</h3>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-500 font-medium">
                      <div className="flex items-center gap-1.5">
                        <RiInformationFill className="text-slate-400" />
                        Código: <span className="text-slate-900">{focusedGroup.code || "No asignado"}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <RiUser3Fill className="text-slate-400" />
                        Matriculados: <span className="text-slate-900">{focusedGroup.studentCount}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                     <Button 
                        variant="secondary"
                        className="!h-12 !px-6"
                        onClick={openEditModal}
                      >
                        <RiSettings4Fill className="text-lg" />
                        Configuración
                     </Button>
                     <button 
                       className="w-12 h-12 rounded-xl flex items-center justify-center bg-white text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-100 hover:border-red-100 transition-all shadow-sm"
                       title="Eliminar Grupo"
                       onClick={() => {
                         if (window.confirm("¿Estás seguro de que deseas eliminar este grupo? Esta acción no se puede deshacer.")) {
                           handleDeleteGroup(focusedGroup.id);
                         }
                       }}
                     >
                       <RiDeleteBinLine className="text-xl" />
                     </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
                {/* List of enrolled students */}
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4">
                    <h4 className="eyebrow">Directorio de Matriculaciones</h4>
                    
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <RiSearchLine className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          className="h-10 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:border-brand-maroon focus:ring-4 focus:ring-brand-maroon/5 transition-all w-full sm:w-64"
                          placeholder="Buscar por nombre o email..."
                          value={studentSearch}
                          onChange={(e) => setStudentSearch(e.target.value)}
                        />
                      </div>
                      
                      <Tabs 
                        tabs={[
                          { id: "all", label: "Todos" },
                          { id: "enrolled", label: "Sí" },
                          { id: "not_enrolled", label: "No" },
                        ]}
                        activeTab={enrollmentFilter}
                        onTabChange={(id) => setEnrollmentFilter(id as any)}
                        variant="primary"
                        className="!p-1 !rounded-xl"
                      />
                    </div>
                  </div>
                  
                  <div className="grid gap-3">
                    {(() => {
                      const filteredStudents = allStudents.filter((student: UserEntity) => {
                        const searchLower = studentSearch.toLowerCase().trim();
                        const matchesSearch = !searchLower || 
                                              student.firstName.toLowerCase().includes(searchLower) || 
                                              student.lastName.toLowerCase().includes(searchLower) || 
                                              student.email.toLowerCase().includes(searchLower);
                        
                        const isEnrolled = groupEnrollments?.some(e => e.studentId === student.id && !e.revokedAt);
                        const matchesFilter = enrollmentFilter === "all" || 
                                              (enrollmentFilter === "enrolled" && isEnrolled) || 
                                              (enrollmentFilter === "not_enrolled" && !isEnrolled);
                        
                        return matchesSearch && matchesFilter;
                      });

                      if (loading && allStudents.length === 0) {
                        return (
                          <div className="py-20 text-center">
                            <RiRefreshLine className="mx-auto text-4xl text-brand-maroon animate-spin mb-4" />
                            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Cargando alumnos...</p>
                          </div>
                        );
                      }

                      if (filteredStudents.length === 0) {
                        return (
                          <EmptyState 
                            title={studentSearch ? "No hay coincidencias" : "No hay alumnos registrados"}
                            description={studentSearch ? "Intenta con otro nombre o correo." : "Utiliza el panel de la derecha para matricular alumnos masivamente."}
                            icon={<RiUser3Fill className="text-6xl text-slate-100" />}
                            className="py-20 bg-slate-50/30 border-2 border-dashed border-slate-100 rounded-[3rem]"
                          />
                        );
                      }

                      return filteredStudents.map((student: UserEntity) => {
                        const enrollment = groupEnrollments?.find(e => e.studentId === student.id && !e.revokedAt);
                        const isEnrolled = !!enrollment;
                        const isBusy = busy === `enroll:${student.id}` || (enrollment && busy === `revoke:${enrollment.id}`);

                        return (
                          <div 
                            key={student.id}
                            className={`group flex items-center justify-between p-5 rounded-3xl border transition-all duration-300 ${
                              isEnrolled ? 'border-brand-blue/10 bg-brand-blue/5' : 'border-slate-100 bg-white hover:border-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg transition-all duration-500 ${
                                isEnrolled 
                                  ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/20' 
                                  : 'bg-slate-100 text-slate-400 group-hover:bg-brand-blue/10 group-hover:text-brand-blue'
                              }`}>
                                {isEnrolled ? <RiCheckFill /> : <RiUser3Fill />}
                              </div>
                              <div>
                                <h5 className="font-bold text-slate-900 leading-none mb-1">
                                  {student.lastName}, {student.firstName}
                                </h5>
                                <p className="text-xs text-slate-500 font-medium">{student.email}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              {isBusy ? (
                                <div className="w-12 h-6 flex items-center justify-center">
                                  <RiRefreshLine className="animate-spin text-brand-blue text-lg" />
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleToggleEnrollment(student.id, !!isEnrolled)}
                                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-maroon focus:ring-offset-2 ${
                                    isEnrolled ? 'bg-emerald-500' : 'bg-slate-200'
                                  }`}
                                >
                                  <span
                                    className={`pointer-events-none relative inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                                      isEnrolled ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                                  >
                                    {isEnrolled && <RiCheckFill className="text-emerald-600 text-xs" />}
                                  </span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Enrollment Card */}
                <div className="space-y-4 sticky top-8">
                  <h4 className="eyebrow px-4">Ingesta de Alumnos</h4>
                  <div className="p-8 rounded-[3rem] bg-brand-maroon text-white shadow-2xl relative overflow-hidden border border-brand-maroon-dark">
                     <div className="absolute -right-10 -bottom-10 p-12 opacity-[0.05] text-[12rem] text-white pointer-events-none rotate-12">
                        <RiUser3Fill />
                     </div>
                     
                     <div className="relative z-10 space-y-6">
                        <div className="space-y-3">
                           <h5 className="font-bold text-lg">Añadir Estudiantes</h5>
                           <p className="text-xs text-slate-400 leading-relaxed">
                             Pega una lista de <strong>Nombres y Apellidos</strong> (ej: "García López, Juan") o correos electrónicos, uno por línea.
                           </p>
                           <textarea 
                             className="w-full bg-white/5 border border-white/10 rounded-[2rem] p-5 text-sm text-white focus:outline-none focus:ring-4 focus:ring-brand-gold/20 min-h-[220px] placeholder:text-white/20 transition-all"
                             placeholder="Apellidos, Nombre&#10;García, Juan&#10;estudiante@dockus.io..."
                             value={bulkInput}
                             onChange={(e) => setBulkInput(e.target.value)}
                           />
                        </div>
                        <Button 
                          variant="primary"
                          className="w-full h-14 flex items-center justify-center gap-3 rounded-2xl bg-white !text-brand-maroon font-bold hover:bg-brand-cream transition-all transform hover:-translate-y-1 shadow-xl shadow-brand-maroon/20 disabled:opacity-50 disabled:transform-none"
                          disabled={!bulkInput.trim() || !!busy}
                          onClick={handleEnrollStudents}
                        >
                          <RiCheckFill className="text-xl" />
                          {busy === "enroll" ? "Procesando..." : "Matricular en Grupo"}
                        </Button>
                     </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Default view when no group is selected: Still show the student list but with a clear empty state for enrollments */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4">
                <h4 className="eyebrow">Listado General de Alumnos</h4>
                <div className="relative">
                  <RiSearchLine className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    className="h-10 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:border-brand-maroon focus:ring-4 focus:ring-brand-maroon/5 transition-all w-full sm:w-64"
                    placeholder="Busca alumnos para gestionar..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-3">
                {(() => {
                  const filteredStudents = allStudents.filter((student: UserEntity) => {
                    const matchesSearch = student.firstName.toLowerCase().includes(studentSearch.toLowerCase()) || 
                                          student.lastName.toLowerCase().includes(studentSearch.toLowerCase()) || 
                                          student.email.toLowerCase().includes(studentSearch.toLowerCase());
                    return matchesSearch;
                  });

                  if (filteredStudents.length === 0) {
                    return (
                      <EmptyState 
                        title="No se encontraron alumnos"
                        description="Prueba con otros criterios de búsqueda."
                        icon={<RiUser3Fill className="text-6xl text-slate-100" />}
                        className="py-20 bg-slate-50/30 border-2 border-dashed border-slate-100 rounded-[3rem]"
                      />
                    );
                  }

                  return filteredStudents.map(student => (
                    <div key={student.id} className="flex items-center justify-between p-5 rounded-3xl border border-slate-100 bg-white/50 opacity-60">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold uppercase">
                          {student.firstName[0]}{student.lastName[0]}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-400">{student.lastName}, {student.firstName}</p>
                          <p className="text-[11px] text-slate-400 font-medium">{student.email}</p>
                        </div>
                      </div>
                      <div className="ui-label text-slate-400 bg-slate-50 rounded-lg">
                        Selecciona un grupo
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Modal overlays */}
      {isEditing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-xl font-bold text-slate-900">Configuración de Grupo</h4>
                <p className="text-sm text-slate-500 mt-1">Modifica los detalles del grupo docente.</p>
              </div>
              <button 
                onClick={() => setIsEditing(false)}
                className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-slate-50 text-slate-400 transition-colors"
              >
                ×
              </button>
            </div>
            
            <div className="p-8 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Nombre del Grupo</label>
                <input 
                  className="w-full h-14 px-5 rounded-2xl bg-slate-50 border border-slate-100 focus:border-brand-maroon focus:ring-4 focus:ring-brand-maroon/5 transition-all text-sm font-bold" 
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Código Identificador</label>
                <input 
                  className="w-full h-14 px-5 rounded-2xl bg-slate-50 border border-slate-100 focus:border-brand-maroon focus:ring-4 focus:ring-brand-maroon/5 transition-all text-sm font-bold" 
                  value={editForm.code}
                  onChange={(e) => setEditForm(prev => ({ ...prev, code: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Descripción (Opcional)</label>
                <textarea 
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:border-brand-maroon focus:ring-4 focus:ring-brand-maroon/5 transition-all text-sm font-medium min-h-[100px]" 
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
            </div>

            <div className="p-8 bg-slate-50/50 flex gap-3">
              <Button 
                variant="secondary"
                className="flex-1 !h-14"
                onClick={() => setIsEditing(false)}
              >
                Cancelar
              </Button>
              <Button 
                variant="primary"
                className="flex-1 !h-14 shadow-none"
                disabled={!editForm.name || busy === `update:${focusedGroupId}`}
                onClick={async () => {
                  if (focusedGroupId) {
                    await handleUpdateGroup(focusedGroupId, editForm);
                    setIsEditing(false);
                  }
                }}
              >
                {busy === `update:${focusedGroupId}` ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

