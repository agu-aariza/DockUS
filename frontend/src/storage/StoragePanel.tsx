import { useEffect, useState } from 'react';
import { DangerConfirmModal } from '../shared/components/DangerConfirmModal';
import { JsonResult } from '../shared/components/JsonResult';
import { Button } from '../shared/components/ui/Button';
import { Card } from '../shared/components/ui/Layout';
import { useToast } from '../shared/toast/ToastContext';
import type { SessionRecord } from '../shared/types';
import { useStorageManagement } from './hooks/useStorageManagement';

interface StoragePanelProps {
  session: SessionRecord | null;
}

type StorageTab = 'subida' | 'consulta' | 'inventario';

export function StoragePanel({ session }: StoragePanelProps): JSX.Element {
  const sc = useStorageManagement(session);
  const [activeTab, setActiveTab] = useState<StorageTab>('subida');
  const { pushToast } = useToast();

  useEffect(() => {
    if (!sc.message.trim()) {
      return;
    }

    pushToast({
      title: 'Almacenamiento',
      description: sc.message,
      tone: sc.message.includes('[4') || sc.message.toLowerCase().includes('error') ? 'error' : 'info',
    });
    sc.setMessage('');
  }, [pushToast, sc.message, sc.setMessage]);

  return (
    <div className="space-y-8 animate-fade-in">
      <header>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Almacenamiento de artefactos</h2>
        <p className="text-slate-500 text-sm">Gestiona entregas subidas, hashes y objetos persistidos del proyecto.</p>
      </header>

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {[
          { id: 'subida', label: 'Subida' },
          { id: 'consulta', label: 'Consulta' },
          { id: 'inventario', label: 'Inventario' },
        ].map((tab) => (
          <button
            key={tab.id}
            className={`px-4 py-3 text-sm font-semibold transition ${
              activeTab === tab.id
                ? 'border-b-2 border-slate-900 text-slate-950'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => setActiveTab(tab.id as StorageTab)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'subida' ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-6">Subir artefacto</h3>
          <form className="space-y-6" onSubmit={sc.handleUpload}>
            <div>
              <label className="label-text">Identificador de entrega (UUID)</label>
              <input required className="input-field" value={sc.uploadForm.deliveryId} onChange={e => sc.setUploadForm(p => ({ ...p, deliveryId: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="label-text">Nombre lógico</label>
                <input required className="input-field" value={sc.uploadForm.logicalName} onChange={e => sc.setUploadForm(p => ({ ...p, logicalName: e.target.value }))} />
              </div>
              <div>
                <label className="label-text">Hash de verificación</label>
                <input required className="input-field font-mono text-xs" value={sc.uploadForm.hash} onChange={e => sc.setUploadForm(p => ({ ...p, hash: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="label-text">Archivo</label>
              <input type="file" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-all" required onChange={e => sc.handleFileChange(e.target.files?.[0] ?? null)} />
            </div>
            <div className="flex gap-4 pt-4 border-t border-slate-100">
              <button type="button" className="btn-secondary flex-1" onClick={() => void sc.handleComputeHash()} disabled={!sc.file || sc.hashLoading}>
                {sc.hashLoading ? 'Calculando...' : 'Verificar integridad'}
              </button>
              <button type="submit" className="btn-primary flex-1" disabled={!sc.canUpload || !sc.file}>
                Subir archivo
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {activeTab === 'consulta' ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-6">Consultar registro</h3>
          <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="label-text">Página</label>
              <input type="number" className="input-field" value={sc.query.page} onChange={e => sc.setQuery(p => ({ ...p, page: e.target.value }))} />
            </div>
            <div>
              <label className="label-text">Límite</label>
              <input type="number" className="input-field" value={sc.query.limit} onChange={e => sc.setQuery(p => ({ ...p, limit: e.target.value }))} />
            </div>
          </div>
          <div className="mb-6">
            <label className="label-text">Filtrar por entrega</label>
            <input className="input-field" placeholder="Introduce el UUID de la entrega..." value={sc.query.deliveryId} onChange={e => sc.setQuery(p => ({ ...p, deliveryId: e.target.value }))} />
          </div>
          <button className="btn-secondary w-full" onClick={() => void sc.handleList()} disabled={!sc.canRead}>
            Consultar registro
          </button>
        </div>
      ) : null}

      {activeTab === 'inventario' ? (
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Objetos almacenados</h3>
        </div>
        {sc.listResponse ? (
          <>
          <div className="space-y-3 p-4 lg:hidden">
            {sc.listResponse.data.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="font-mono text-xs text-slate-500">{item.id}</div>
                <div className="mt-2 text-sm font-semibold text-slate-950">{item.logicalName}</div>
                <div className="mt-3 text-sm text-slate-600">{item.sizeBytes} bytes</div>
                <button 
                  className="mt-4 text-xs font-bold text-rose-600 hover:text-rose-800 uppercase tracking-widest"
                  onClick={() => { sc.setActionId(item.id); sc.setDangerAction('DELETE'); sc.setConfirmOpen(true); }}
                >
                  Eliminar
                </button>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  <th className="px-6 py-4">ID interno</th>
                  <th className="px-6 py-4">Nombre lógico</th>
                  <th className="px-6 py-4">Tamaño</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sc.listResponse.data.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors text-sm">
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">{item.id}</td>
                    <td className="px-6 py-4 font-semibold text-slate-900">{item.logicalName}</td>
                    <td className="px-6 py-4 text-slate-600">{item.sizeBytes} Bytes</td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        className="text-xs font-bold text-rose-600 hover:text-rose-800 uppercase tracking-widest"
                        onClick={() => { sc.setActionId(item.id); sc.setDangerAction('DELETE'); sc.setConfirmOpen(true); }}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        ) : (
          <div className="p-12 text-center text-slate-400 text-sm italic">
            Lanza una consulta para visualizar los artefactos almacenados.
          </div>
        )}
      </div>
      ) : null}

      <DangerConfirmModal
        open={sc.confirmOpen}
        title={sc.dangerAction === 'PURGE' ? 'Confirmar purga del registro' : 'Confirmar eliminación del archivo'}
        description={`Esta acción eliminará de forma permanente el objeto ${sc.actionId} del almacenamiento.`}
        confirmWord={sc.dangerAction}
        onCancel={() => sc.setConfirmOpen(false)}
        onConfirm={() => sc.executeDanger()}
      />
    </div>
  );
}
