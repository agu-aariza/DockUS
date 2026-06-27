import { useEffect, useState, useMemo } from 'react';
import { 
  RiCloudFill, RiUploadCloud2Fill, RiFileSearchFill, RiDatabase2Fill, 
  RiHardDrive2Fill, RiShieldCheckFill, RiFileList3Fill,
  RiDeleteBin7Line, RiSearch2Line
} from 'react-icons/ri';
import { DangerConfirmModal } from '../shared/components/DangerConfirmModal';
import { PageHeader } from '../shared/components/ui/PageHeader';
import { StatsOverview } from '../shared/components/ui/StatsOverview';
import { useToast } from '../shared/toast/ToastContext';
import type { SessionRecord } from "../features/auth/types";
import { useStorageManagement } from './hooks/useStorageManagement';
import { Button } from '../shared/components/ui/Button';
import { Tabs } from '../shared/components/ui/Tabs';
import { StatusBadge } from '../shared/components/ui/StatusBadge';
import { EmptyState } from '../shared/components/EmptyState';

interface StoragePanelProps {
  session: SessionRecord | null;
}

type StorageTab = 'subida' | 'consulta' | 'inventario';

export function StoragePanel({ session }: StoragePanelProps): JSX.Element {
  const sc = useStorageManagement(session);
  const [activeTab, setActiveTab] = useState<StorageTab>('subida');
  const { pushToast } = useToast();

  useEffect(() => {
    if (!sc.message.trim()) return;
    pushToast({
      title: 'Almacenamiento',
      description: sc.message,
      tone: sc.message.includes('[4') || sc.message.toLowerCase().includes('error') ? 'error' : 'info',
    });
    sc.setMessage('');
  }, [pushToast, sc.message, sc.setMessage]);

  const stats = useMemo(() => {
    const totalItems = sc.listResponse?.meta.total || 0;
    const totalBytes = sc.listResponse?.data.reduce((acc, curr) => acc + curr.sizeBytes, 0) || 0;
    const formattedSize = totalBytes > 1024 * 1024 
      ? `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`
      : `${(totalBytes / 1024).toFixed(2)} KB`;

    return [
      { label: 'Artefactos', value: totalItems, icon: <RiFileList3Fill />, variant: 'info' as const },
      { label: 'Espacio ocupado', value: formattedSize, icon: <RiHardDrive2Fill />, variant: 'default' as const },
      { label: 'SLA Subida', value: '99.9%', icon: <RiShieldCheckFill />, variant: 'success' as const },
      { label: 'Nodos', value: 'Distribuido', icon: <RiDatabase2Fill />, variant: 'dark' as const },
    ];
  }, [sc.listResponse]);

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Bóveda de Artefactos"
        subtitle="Repositorio centralizado de objetos persistidos, binarios y evidencias de compilación del ecosistema DockUS."
        icon={<RiCloudFill />}
        badge="Storage Service"
      />

      <StatsOverview stats={stats} />

      <Tabs 
        tabs={[
          { id: 'subida', label: 'Cargar Objeto', icon: RiUploadCloud2Fill },
          { id: 'consulta', label: 'Búsqueda Global', icon: RiFileSearchFill },
          { id: 'inventario', label: 'Explorador', icon: RiDatabase2Fill },
        ]}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as StorageTab)}
      />

      {activeTab === 'subida' ? (
        <div className="card">
          <div className="panel-header">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-subtle text-primary">
                <RiUploadCloud2Fill />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Ingesta de Artefactos</h3>
                <p className="text-sm text-slate-500">Sube archivos y asócialos a entregas específicas del proyecto.</p>
              </div>
            </div>
          </div>
          
          <form className="p-6 space-y-6" onSubmit={sc.handleUpload}>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <label className="label-text">ID de Entrega (UUID)</label>
                  <input 
                    required 
                    className="input-field" 
                    placeholder="00000000-0000-0000-0000-000000000000"
                    value={sc.uploadForm.deliveryId} 
                    onChange={e => sc.setUploadForm(p => ({ ...p, deliveryId: e.target.value }))} 
                  />
                </div>
                <div>
                  <label className="label-text">Nombre Lógico</label>
                  <input 
                    required 
                    className="input-field" 
                    placeholder="ej: build_v1.zip"
                    value={sc.uploadForm.logicalName} 
                    onChange={e => sc.setUploadForm(p => ({ ...p, logicalName: e.target.value }))} 
                  />
                </div>
              </div>
              
              <div>
                <label className="label-text">Selección de Binario</label>
                <div className={`relative border-2 border-dashed rounded-lg p-6 transition-colors flex flex-col items-center justify-center text-center cursor-pointer ${sc.file ? 'border-primary bg-primary-subtle' : 'border-app-border bg-slate-50 hover:border-slate-400'}`}>
                  <input 
                    type="file" 
                    className="absolute inset-0 opacity-0 cursor-pointer" 
                    required 
                    onChange={e => sc.handleFileChange(e.target.files?.[0] ?? null)} 
                  />
                  <RiCloudFill className={`text-2xl mb-2 ${sc.file ? 'text-primary' : 'text-slate-400'}`} />
                  <div className="text-sm font-medium text-slate-900 truncate max-w-full">
                    {sc.file ? sc.file.name : 'Click o arrastra archivo'}
                  </div>
                  {sc.file && (
                    <div className="text-xs text-primary font-medium mt-1">
                      {(sc.file.size / 1024).toFixed(1)} KB detectados
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-app-border">
              <Button 
                type="submit" 
                disabled={!sc.canUpload || !sc.file}
                variant="primary"
              >
                Publicar en Bóveda
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {activeTab === 'consulta' ? (
        <div className="max-w-3xl mx-auto">
          <div className="card p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 mx-auto mb-4 text-slate-600">
              <RiSearch2Line className="text-2xl" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 mb-1">Motor de Búsqueda de Objetos</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-lg mx-auto">Consulta el registro global de artefactos filtrando por proyecto, entrega o ejecución.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left mb-6">
              <div className="space-y-4 col-span-2 sm:col-span-1">
                <div>
                  <label className="label-text">Proyecto</label>
                  <select 
                    className="input-field" 
                    value={sc.query.projectId} 
                    onChange={e => sc.setQuery(p => ({ ...p, projectId: e.target.value }))}
                  >
                    <option value="">-- Todos los Proyectos --</option>
                    {sc.projectsList.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-text">Entrega (Versión / Alumno)</label>
                  <select 
                    className="input-field" 
                    value={sc.query.deliveryId} 
                    disabled={!sc.query.projectId}
                    onChange={e => sc.setQuery(p => ({ ...p, deliveryId: e.target.value }))}
                  >
                    <option value="">-- Todas las Entregas --</option>
                    {sc.deliveriesList.map(d => (
                      <option key={d.id} value={d.id}>
                        V{d.version} - {d.studentName || ''} ({d.status})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-text">Ejecución (Run / Estado)</label>
                  <select 
                    className="input-field" 
                    value={sc.query.runId} 
                    disabled={!sc.query.deliveryId}
                    onChange={e => sc.setQuery(p => ({ ...p, runId: e.target.value }))}
                  >
                    <option value="">-- Todos los Runs --</option>
                    {sc.runsList.map(r => (
                      <option key={r.id} value={r.id}>
                        Run {r.id.substring(0,8)} - {r.status} ({new Date(r.createdAt).toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="space-y-4 col-span-2 sm:col-span-1">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-text">Página</label>
                    <input type="number" className="input-field" value={sc.query.page} onChange={e => sc.setQuery(p => ({ ...p, page: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label-text">Límite</label>
                    <input type="number" className="input-field" value={sc.query.limit} onChange={e => sc.setQuery(p => ({ ...p, limit: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="label-text">Subido Desde</label>
                  <input type="date" className="input-field" value={sc.query.createdFrom} onChange={e => sc.setQuery(p => ({ ...p, createdFrom: e.target.value }))} />
                </div>
                <div>
                  <label className="label-text">Subido Hasta</label>
                  <input type="date" className="input-field" value={sc.query.createdTo} onChange={e => sc.setQuery(p => ({ ...p, createdTo: e.target.value }))} />
                </div>
              </div>
            </div>

            <Button 
              onClick={() => { void sc.handleList(); setActiveTab('inventario'); }} 
              disabled={!sc.canRead}
              variant="primary"
            >
              Consultar Registro Maestro
            </Button>
          </div>
        </div>
      ) : null}

      {activeTab === 'inventario' ? (
        <div className="card">
          <div className="panel-header">
            <h3 className="text-base font-semibold text-slate-900">Objetos Persistidos</h3>
          </div>
          
          {sc.unifiedItems && sc.unifiedItems.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-app-border bg-slate-50">
                    <th className="px-6 py-3 text-xs font-semibold text-slate-500">Ficha Técnica</th>
                    <th className="px-6 py-3 text-xs font-semibold text-slate-500">Asociación</th>
                    <th className="px-6 py-3 text-xs font-semibold text-slate-500">Tamaño / Tipo</th>
                    <th className="px-6 py-3 text-xs font-semibold text-slate-500 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {sc.unifiedItems.map((item) => {
                    const isRunArtifact = item.itemType === 'run_artifact';
                    return (
                      <tr key={`${item.itemType}-${item.id}`} className="group hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className={`h-9 w-9 rounded-md flex items-center justify-center text-base border shrink-0 ${
                              isRunArtifact 
                                ? 'bg-slate-100 text-slate-600 border-slate-200'
                                : item.contentType.includes('zip')
                                  ? 'bg-primary-subtle text-primary border-primary/20'
                                  : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                            }`}>
                              {isRunArtifact ? <RiFileList3Fill /> : <RiDatabase2Fill />}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-slate-900 truncate">
                                {item.logicalName}
                              </div>
                              <div className="mt-1 flex items-center gap-2">
                                <StatusBadge tone={isRunArtifact ? 'idle' : 'info'}>
                                  {isRunArtifact ? 'LOG/REPORT' : 'SOURCE'}
                                </StatusBadge>
                                <span className="text-xs font-mono text-slate-500 truncate">
                                  ID: {item.id.substring(0, 16)}...
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs space-y-1">
                            {item.projectName && (
                              <div className="font-medium text-slate-900">{item.projectName}</div>
                            )}
                            {item.deliveryVersion !== undefined && (
                              <div className="text-xs text-slate-500">
                                Entrega V{item.deliveryVersion} 
                                {item.studentName ? ` • ${item.studentName}` : ''}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center w-fit px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200">
                              {item.sizeBytes > 1024 * 1024 ? `${(item.sizeBytes / (1024 * 1024)).toFixed(2)} MB` : `${(item.sizeBytes / 1024).toFixed(1)} KB`}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500 max-w-[150px] truncate">
                              {item.contentType}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => { void sc.handlePreview(item); }}
                            >
                              Vista Previa
                            </Button>

                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => { void sc.handleDownloadItem(item); }}
                            >
                              Descargar
                            </Button>

                            {!isRunArtifact && sc.canSoftDelete && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-slate-500 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100"
                                onClick={() => { sc.setActionId(item.id); sc.setDangerAction('DELETE'); sc.setConfirmOpen(true); }}
                                aria-label="Eliminar"
                              >
                                <RiDeleteBin7Line className="text-base" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState 
              icon={<RiDatabase2Fill className="text-2xl text-slate-400" />}
              title="Sin resultados"
              description="Inicia una búsqueda global para visualizar el inventario."
              className="m-6"
            />
          )}
        </div>
      ) : null}

      {/* Vista Previa Modal */}
      {sc.previewTitle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="card w-full max-w-4xl max-h-[85vh] flex flex-col bg-white">
            <div className="panel-header">
              <div>
                <span className="text-xs font-semibold text-primary uppercase tracking-wide">Previsualizador de Artefactos</span>
                <h3 className="text-base font-semibold text-slate-900 mt-0.5">{sc.previewTitle}</h3>
              </div>
              <Button 
                variant="secondary"
                size="sm"
                onClick={() => { sc.setPreviewTitle(''); sc.setPreviewContent(null); }}
              >
                Cerrar
              </Button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 font-mono text-xs text-slate-900 bg-slate-50">
              {sc.previewLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
                  <div className="text-xs font-medium text-slate-500">Procesando y extrayendo contenido...</div>
                </div>
              ) : sc.previewContent === null ? (
                <div className="text-center py-20 text-slate-500 italic">No se pudo cargar la vista previa.</div>
              ) : typeof sc.previewContent === 'string' ? (
                <pre className="whitespace-pre-wrap bg-white p-4 rounded-md border border-app-border overflow-x-auto max-h-[50vh] text-left leading-relaxed">
                  {sc.previewContent}
                </pre>
              ) : Array.isArray(sc.previewContent) ? (
                <div className="space-y-4">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Archivos contenidos en el paquete ZIP ({sc.previewContent.length}):</div>
                  <div className="space-y-3">
                    {sc.previewContent.map((file, i) => (
                      <details key={i} className="group border border-app-border rounded-md bg-white overflow-hidden">
                        <summary className="p-4 font-medium text-xs text-slate-900 hover:bg-slate-50 cursor-pointer flex items-center justify-between list-none">
                          <span className="flex items-center gap-2">
                            <RiFileList3Fill className="text-primary" />
                            {file.path}
                          </span>
                          <span className="text-xs text-primary font-medium group-open:hidden">Desplegar</span>
                          <span className="text-xs text-slate-500 font-medium hidden group-open:inline">Contraer</span>
                        </summary>
                        <div className="p-4 border-t border-app-border bg-slate-50">
                          <pre className="whitespace-pre-wrap overflow-x-auto text-left leading-relaxed text-[11px] max-h-[40vh]">
                            {file.content || <span className="italic text-slate-500">[Archivo vacío]</span>}
                          </pre>
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 text-slate-500 italic">Formato de vista previa no soportado.</div>
              )}
            </div>

            <div className="p-4 border-t border-app-border flex items-center justify-end bg-white">
              <Button 
                variant="primary"
                size="sm"
                onClick={() => { sc.setPreviewTitle(''); sc.setPreviewContent(null); }}
              >
                Cerrar Vista Previa
              </Button>
            </div>
          </div>
        </div>
      )}

      <DangerConfirmModal
        open={sc.confirmOpen}
        title={sc.dangerAction === 'PURGE' ? 'Purga de Artefacto' : 'Eliminación Crítica'}
        description={`¿Confirmas la eliminación permanente del objeto ${sc.actionId}? Esta acción liberará espacio en la bóveda pero invalidará cualquier referencia de compilación futura.`}
        confirmWord={sc.dangerAction}
        onCancel={() => sc.setConfirmOpen(false)}
        onConfirm={() => sc.executeDanger()}
      />
    </div>
  );
}
