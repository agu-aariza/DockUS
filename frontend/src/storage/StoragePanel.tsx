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
import type { SessionRecord } from '../shared/types';
import { useStorageManagement } from './hooks/useStorageManagement';
import { Button } from '../shared/components/ui/Button';
import { Tabs } from '../shared/components/ui/Tabs';

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
      { label: 'Artefactos', value: totalItems, icon: <RiFileList3Fill />, variant: 'primary' as const },
      { label: 'Espacio ocupado', value: formattedSize, icon: <RiHardDrive2Fill />, variant: 'secondary' as const },
      { label: 'SLA Subida', value: '99.9%', icon: <RiShieldCheckFill />, variant: 'success' as const },
      { label: 'Nodos', value: 'Distribuido', icon: <RiDatabase2Fill />, variant: 'accent' as const },
    ];
  }, [sc.listResponse]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
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
        variant="primary"
      />

      {activeTab === 'subida' ? (
        <div>
          <div className="card card-top-accent-primary">
            <div className="p-8 border-b border-academic-surface-variant/40 flex items-center justify-between bg-academic-surface-container-lowest/40">
              <div>
                <h3 className="font-display text-xl font-bold tracking-tight text-academic-on-surface flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-academic-primary text-white flex items-center justify-center shadow-academic">
                    <RiUploadCloud2Fill />
                  </div>
                  Ingesta de Artefactos
                </h3>
                <p className="text-academic-outline text-xs font-medium mt-1">Sube archivos y asócialos a entregas específicas del proyecto.</p>
              </div>
            </div>
            
            <form className="p-8 space-y-6" onSubmit={sc.handleUpload}>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-academic-outline uppercase tracking-wider mb-2 block">ID de Entrega (UUID)</label>
                    <input 
                      required 
                      className="input-field" 
                      placeholder="00000000-0000-0000-0000-000000000000"
                      value={sc.uploadForm.deliveryId} 
                      onChange={e => sc.setUploadForm(p => ({ ...p, deliveryId: e.target.value }))} 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-academic-outline uppercase tracking-wider mb-2 block">Nombre Lógico</label>
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
                  <label className="text-[10px] font-black text-academic-outline uppercase tracking-wider mb-2 block">Selección de Binario</label>
                  <div className={`relative border-2 border-dashed rounded-2xl p-8 transition-all flex flex-col items-center justify-center text-center cursor-pointer ${sc.file ? 'border-academic-primary bg-academic-primary/5' : 'border-academic-surface-variant bg-academic-surface hover:border-academic-outline'}`}>
                    <input 
                      type="file" 
                      className="absolute inset-0 opacity-0 cursor-pointer" 
                      required 
                      onChange={e => sc.handleFileChange(e.target.files?.[0] ?? null)} 
                    />
                    <RiCloudFill className={`text-4xl mb-2 ${sc.file ? 'text-academic-primary' : 'text-academic-outline'}`} />
                    <div className="text-xs font-bold text-academic-on-surface truncate max-w-full">
                      {sc.file ? sc.file.name : 'Click o arrastra archivo'}
                    </div>
                    {sc.file && (
                      <div className="text-[10px] text-academic-primary font-bold mt-1 uppercase tracking-widest">
                        {(sc.file.size / 1024).toFixed(1)} KB detectados
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-4 pt-6 border-t border-academic-surface-variant/40">
                <Button 
                  type="submit" 
                  className="px-8 py-3 rounded-xl"
                  disabled={!sc.canUpload || !sc.file}
                  variant="primary"
                >
                  Publicar en Bóveda
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {activeTab === 'consulta' ? (
        <div className="max-w-3xl mx-auto">
          <div className="card p-8 text-center border-t-2 border-t-academic-secondary">
            <div className="h-16 w-16 bg-academic-secondary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-academic-secondary/20">
              <RiSearch2Line className="text-3xl text-academic-secondary" />
            </div>
            <h3 className="font-display text-xl font-bold tracking-tight text-academic-on-surface mb-2">Motor de Búsqueda de Objetos</h3>
            <p className="text-academic-on-surface-variant text-sm font-medium mb-8 max-w-lg mx-auto">Consulta el registro global de artefactos filtrando por proyecto, entrega o ejecución.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left mb-8">
              <div className="space-y-4 col-span-2 sm:col-span-1">
                <div>
                  <label className="text-[10px] font-black text-academic-outline uppercase tracking-wider mb-2 block">Proyecto</label>
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
                  <label className="text-[10px] font-black text-academic-outline uppercase tracking-wider mb-2 block">Entrega (Versión / Alumno)</label>
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
                  <label className="text-[10px] font-black text-academic-outline uppercase tracking-wider mb-2 block">Ejecución (Run / Estado)</label>
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
                    <label className="text-[10px] font-black text-academic-outline uppercase tracking-wider mb-2 block">Página</label>
                    <input type="number" className="input-field" value={sc.query.page} onChange={e => sc.setQuery(p => ({ ...p, page: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-academic-outline uppercase tracking-wider mb-2 block">Límite</label>
                    <input type="number" className="input-field" value={sc.query.limit} onChange={e => sc.setQuery(p => ({ ...p, limit: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-academic-outline uppercase tracking-wider mb-2 block">Subido Desde</label>
                  <input type="date" className="input-field" value={sc.query.createdFrom} onChange={e => sc.setQuery(p => ({ ...p, createdFrom: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-academic-outline uppercase tracking-wider mb-2 block">Subido Hasta</label>
                  <input type="date" className="input-field" value={sc.query.createdTo} onChange={e => sc.setQuery(p => ({ ...p, createdTo: e.target.value }))} />
                </div>
              </div>
            </div>

            <Button 
              className="px-8 py-3 rounded-xl"
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
          <div className="p-6 border-b border-academic-surface-variant/40 flex items-center justify-between bg-academic-surface-container-lowest/40">
            <h3 className="ui-label">Objetos Persistidos</h3>
          </div>
          
          {sc.unifiedItems && sc.unifiedItems.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] font-black text-academic-outline uppercase tracking-[0.2em] border-b border-academic-surface-variant/40 bg-academic-surface-container-lowest/20">
                    <th className="px-6 py-4">Ficha Técnica</th>
                    <th className="px-6 py-4">Asociación</th>
                    <th className="px-6 py-4">Tamaño / Tipo</th>
                    <th className="px-6 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-academic-surface-variant/40">
                  {sc.unifiedItems.map((item) => {
                    const isRunArtifact = item.itemType === 'run_artifact';
                    return (
                      <tr key={`${item.itemType}-${item.id}`} className="group hover:bg-academic-surface transition-all duration-300">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-5">
                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-lg border shrink-0 group-hover:scale-105 transition-transform ${
                              isRunArtifact 
                                ? 'bg-academic-secondary/10 text-academic-secondary border-academic-secondary/15'
                                : item.contentType.includes('zip')
                                  ? 'bg-academic-primary/10 text-academic-primary border-academic-primary/15'
                                  : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/15'
                            }`}>
                              {isRunArtifact ? <RiFileList3Fill /> : <RiDatabase2Fill />}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-academic-on-surface group-hover:text-academic-primary transition-colors truncate">
                                {item.logicalName}
                              </div>
                              <div className="text-[10px] font-mono text-academic-outline mt-1 uppercase tracking-tighter truncate flex gap-2">
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold tracking-widest ${
                                  isRunArtifact ? 'bg-academic-secondary/10 text-academic-secondary' : 'bg-academic-primary/10 text-academic-primary'
                                }`}>
                                  {isRunArtifact ? 'LOG/REPORT' : 'SOURCE'}
                                </span>
                                <span>ID: {item.id.substring(0, 16)}...</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="text-xs space-y-1">
                            {item.projectName && (
                              <div className="font-semibold text-academic-on-surface">{item.projectName}</div>
                            )}
                            {item.deliveryVersion !== undefined && (
                              <div className="text-[10px] text-academic-outline">
                                Entrega V{item.deliveryVersion} 
                                {item.studentName ? ` • ${item.studentName}` : ''}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center w-fit px-2 py-0.5 rounded-full bg-academic-surface text-academic-on-surface-variant text-[10px] font-bold border border-academic-surface-variant/60">
                              {item.sizeBytes > 1024 * 1024 ? `${(item.sizeBytes / (1024 * 1024)).toFixed(2)} MB` : `${(item.sizeBytes / 1024).toFixed(1)} KB`}
                            </span>
                            <span className="text-[9px] font-mono text-academic-outline max-w-[150px] truncate">
                              {item.contentType}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Vista Previa Button */}
                            <button
                              className="px-3 py-1.5 text-[11px] font-bold text-academic-primary hover:bg-academic-primary/10 rounded-lg transition-all"
                              onClick={() => { void sc.handlePreview(item); }}
                            >
                              Vista Previa
                            </button>

                            {/* Download Button */}
                            <button
                              className="px-3 py-1.5 text-[11px] font-bold text-academic-on-surface hover:bg-academic-surface-variant/40 rounded-lg transition-all"
                              onClick={() => { void sc.handleDownloadItem(item); }}
                            >
                              Descargar
                            </button>

                            {/* Delete Button (Only for storage objects and authorized roles) */}
                            {!isRunArtifact && sc.canSoftDelete && (
                              <button 
                                className="p-2 text-academic-outline hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                onClick={() => { sc.setActionId(item.id); sc.setDangerAction('DELETE'); sc.setConfirmOpen(true); }}
                              >
                                <RiDeleteBin7Line className="text-lg" />
                              </button>
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
            <div className="p-20 text-center">
              <div className="h-16 w-16 bg-academic-surface rounded-3xl flex items-center justify-center mx-auto mb-4 border border-academic-surface-variant/40">
                <RiDatabase2Fill className="text-2xl text-academic-outline/60" />
              </div>
              <p className="text-academic-outline text-sm font-medium italic">Inicia una búsqueda global para visualizar el inventario.</p>
            </div>
          )}
        </div>
      ) : null}

      {/* Vista Previa Modal */}
      {sc.previewTitle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="card w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 bg-academic-surface-container-lowest">
            <div className="p-6 border-b border-academic-surface-variant/40 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-academic-primary uppercase tracking-widest">Previsualizador de Artefactos</span>
                <h3 className="font-display text-lg font-bold text-academic-on-surface mt-0.5">{sc.previewTitle}</h3>
              </div>
              <button 
                onClick={() => { sc.setPreviewTitle(''); sc.setPreviewContent(null); }}
                className="p-2 hover:bg-academic-surface-variant/40 rounded-xl transition-colors font-bold text-academic-outline"
              >
                Cerrar
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 font-mono text-xs text-academic-on-surface bg-academic-surface-container-lowest/30">
              {sc.previewLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-academic-primary border-t-transparent" />
                  <div className="text-xs font-bold text-academic-outline">Procesando y extrayendo contenido...</div>
                </div>
              ) : sc.previewContent === null ? (
                <div className="text-center py-20 text-academic-outline italic">No se pudo cargar la vista previa.</div>
              ) : typeof sc.previewContent === 'string' ? (
                <pre className="whitespace-pre-wrap bg-academic-surface/40 p-4 rounded-xl border border-academic-surface-variant/30 overflow-x-auto max-h-[50vh] text-left leading-relaxed">
                  {sc.previewContent}
                </pre>
              ) : Array.isArray(sc.previewContent) ? (
                <div className="space-y-6">
                  <div className="text-[10px] font-black uppercase text-academic-outline tracking-wider">Archivos contenidos en el paquete ZIP ({sc.previewContent.length}):</div>
                  <div className="space-y-4">
                    {sc.previewContent.map((file, i) => (
                      <details key={i} className="group border border-academic-surface-variant/30 rounded-xl bg-academic-surface/20 overflow-hidden transition-all">
                        <summary className="p-4 font-bold text-xs text-academic-on-surface hover:bg-academic-surface-variant/20 cursor-pointer flex items-center justify-between list-none">
                          <span className="flex items-center gap-2">
                            <RiFileList3Fill className="text-academic-primary" />
                            {file.path}
                          </span>
                          <span className="text-[10px] text-academic-primary font-black uppercase tracking-wider group-open:hidden">Desplegar</span>
                          <span className="text-[10px] text-academic-outline font-black uppercase tracking-wider hidden group-open:inline">Contraer</span>
                        </summary>
                        <div className="p-4 border-t border-academic-surface-variant/30 bg-academic-surface-container-lowest">
                          <pre className="whitespace-pre-wrap overflow-x-auto text-left leading-relaxed text-[11px] max-h-[40vh]">
                            {file.content || <span className="italic text-academic-outline">[Archivo vacío]</span>}
                          </pre>
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 text-academic-outline italic">Formato de vista previa no soportado.</div>
              )}
            </div>

            <div className="p-6 border-t border-academic-surface-variant/40 flex items-center justify-end bg-academic-surface-container-lowest/40">
              <Button 
                variant="primary"
                onClick={() => { sc.setPreviewTitle(''); sc.setPreviewContent(null); }}
                className="px-6 py-2 rounded-xl"
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
