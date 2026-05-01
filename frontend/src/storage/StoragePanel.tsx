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
    <div className="space-y-10 animate-in fade-in duration-700">
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
          <div>
            <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 overflow-hidden">
              <div className="p-10 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-brand-primary text-white flex items-center justify-center shadow-lg shadow-brand-primary/20">
                      <RiUploadCloud2Fill />
                    </div>
                    Ingesta de Artefactos
                  </h3>
                  <p className="text-slate-400 text-xs font-medium mt-1">Sube archivos y asócialos a entregas específicas del proyecto.</p>
                </div>
              </div>
              
              <form className="p-10 space-y-8" onSubmit={sc.handleUpload}>
                <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                  <div className="space-y-6">
                    <div>
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.15em] mb-3 block">ID de Entrega (UUID)</label>
                      <input 
                        required 
                        className="w-full bg-slate-50 border-slate-200 rounded-xl px-5 py-4 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-brand-primary/5 transition-all placeholder:text-slate-400" 
                        placeholder="00000000-0000-0000-0000-000000000000"
                        value={sc.uploadForm.deliveryId} 
                        onChange={e => sc.setUploadForm(p => ({ ...p, deliveryId: e.target.value }))} 
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.15em] mb-3 block">Nombre Lógico</label>
                      <input 
                        required 
                        className="w-full bg-slate-50 border-slate-200 rounded-xl px-5 py-4 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-brand-primary/5 transition-all placeholder:text-slate-400" 
                        placeholder="ej: build_v1.zip"
                        value={sc.uploadForm.logicalName} 
                        onChange={e => sc.setUploadForm(p => ({ ...p, logicalName: e.target.value }))} 
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.15em] mb-3 block">Selección de Binario</label>
                      <div className={`relative border-2 border-dashed rounded-2xl p-8 transition-all flex flex-col items-center justify-center text-center cursor-pointer ${sc.file ? 'border-brand-primary bg-brand-primary/5' : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'}`}>
                        <input 
                          type="file" 
                          className="absolute inset-0 opacity-0 cursor-pointer" 
                          required 
                          onChange={e => sc.handleFileChange(e.target.files?.[0] ?? null)} 
                        />
                        <RiCloudFill className={`text-4xl mb-2 ${sc.file ? 'text-brand-primary' : 'text-slate-200'}`} />
                        <div className="text-xs font-black text-slate-900 truncate max-w-full">
                          {sc.file ? sc.file.name : 'Click o arrastra archivo'}
                        </div>
                        {sc.file && (
                          <div className="text-[10px] text-brand-primary font-bold mt-1 uppercase tracking-widest">
                            {(sc.file.size / 1024).toFixed(1)} KB detectados
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-4 pt-10 border-t border-slate-100">
                  <Button 
                    type="submit" 
                    className="px-10 py-4 rounded-2xl"
                    disabled={!sc.canUpload || !sc.file}
                    variant="primary"
                  >
                    Publicar en Bóveda
                  </Button>
                </div>
              </form>
            </div>
          </div>

        </div>
      ) : null}

      {activeTab === 'consulta' ? (
        <div className="max-w-4xl mx-auto">
          <div className="bg-white border border-slate-200 rounded-[3rem] shadow-2xl shadow-slate-200/50 p-12 text-center">
            <div className="h-24 w-24 bg-brand-primary/5 rounded-[2rem] flex items-center justify-center mx-auto mb-8 border border-brand-primary/10">
              <RiSearch2Line className="text-4xl text-brand-primary" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-widest mb-4">Motor de Búsqueda de Objetos</h3>
            <p className="text-slate-500 text-sm font-medium mb-12 max-w-lg mx-auto">Consulta el registro global de artefactos filtrando por identificador de entrega o metadatos de subida.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left mb-10">
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 block">ID Entrega (Opcional)</label>
                  <input className="input-field py-4" placeholder="Introduce UUID..." value={sc.query.deliveryId} onChange={e => sc.setQuery(p => ({ ...p, deliveryId: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Subido Desde</label>
                  <input type="date" className="input-field py-4" value={sc.query.createdFrom} onChange={e => sc.setQuery(p => ({ ...p, createdFrom: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Página</label>
                    <input type="number" className="input-field py-4" value={sc.query.page} onChange={e => sc.setQuery(p => ({ ...p, page: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Límite</label>
                    <input type="number" className="input-field py-4" value={sc.query.limit} onChange={e => sc.setQuery(p => ({ ...p, limit: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Subido Hasta</label>
                  <input type="date" className="input-field py-4" value={sc.query.createdTo} onChange={e => sc.setQuery(p => ({ ...p, createdTo: e.target.value }))} />
                </div>
              </div>
            </div>

            <Button 
              className="px-12 py-5 rounded-[2rem]"
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
        <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-xl shadow-slate-200/40 overflow-hidden">
          <div className="p-10 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Objetos Persistidos</h3>
          </div>
          
          {sc.listResponse ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                    <th className="px-10 py-6">Ficha Técnica</th>
                    <th className="px-10 py-6">Dimensiones</th>
                    <th className="px-10 py-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sc.listResponse.data.map((item) => (
                    <tr key={item.id} className="group hover:bg-slate-50 transition-all duration-300">
                      <td className="px-10 py-8">
                        <div className="flex items-center gap-5">
                          <div className="h-12 w-12 rounded-2xl bg-brand-primary/10 flex items-center justify-center text-brand-primary text-xl border border-brand-primary/10 group-hover:scale-110 transition-transform">
                            <RiDatabase2Fill />
                          </div>
                          <div>
                            <div className="text-sm font-black text-slate-900 group-hover:text-brand-primary transition-colors">
                              {item.logicalName}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 mt-1 uppercase tracking-tighter">
                              UUID: {item.id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-8">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest border border-slate-200">
                            {item.sizeBytes > 1024 * 1024 ? `${(item.sizeBytes / (1024 * 1024)).toFixed(2)} MB` : `${(item.sizeBytes / 1024).toFixed(1)} KB`}
                          </span>
                        </div>
                      </td>
                      <td className="px-10 py-8 text-right">
                        <button 
                          className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all opacity-0 group-hover:opacity-100"
                          onClick={() => { sc.setActionId(item.id); sc.setDangerAction('DELETE'); sc.setConfirmOpen(true); }}
                        >
                          <RiDeleteBin7Line className="text-xl" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-32 text-center">
              <div className="h-20 w-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-slate-100">
                <RiDatabase2Fill className="text-3xl text-slate-200" />
              </div>
              <p className="text-slate-400 text-sm font-medium italic">Inicia una búsqueda global para visualizar el inventario.</p>
            </div>
          )}
        </div>
      ) : null}

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
