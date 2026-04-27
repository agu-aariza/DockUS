/**
 * Modal reutilizable para operaciones destructivas.
 *
 * Muestra una tarjeta con confirmación visual clara para reducir borrados
 * accidentales en pantallas operativas.
 */

import { useEffect, useState } from 'react';
import { RiAlertFill, RiCloseLine } from 'react-icons/ri';

interface DangerConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmWord: string;
  confirmButtonLabel?: string;
  loadingLabel?: string;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}

export function DangerConfirmModal({
  open,
  title,
  description,
  confirmWord,
  confirmButtonLabel = 'Eliminar definitivamente',
  loadingLabel = 'Eliminando...',
  onCancel,
  onConfirm,
}: DangerConfirmModalProps): JSX.Element | null {
  const [typed, setTyped] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setTyped('');
      setLoading(false);
    }
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, loading, onCancel]);

  if (!open) return null;

  const canConfirm = typed.trim() === confirmWord;

  const handleConfirm = async () => {
    if (!canConfirm || loading) return;
    setLoading(true);
    try {
      await onConfirm();
      onCancel();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={() => { if (!loading) onCancel(); }}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start gap-4 border-b border-slate-100 px-6 py-5">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-rose-100">
            <RiAlertFill className="text-xl text-rose-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-500 leading-relaxed">{description}</p>
          </div>
          <button
            className="flex-shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            onClick={onCancel}
            disabled={loading}
            aria-label="Cerrar"
          >
            <RiCloseLine className="text-xl" />
          </button>
        </div>

        {/* Confirm input */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-slate-700">
            Escribe <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-bold text-rose-600">{confirmWord}</code> para confirmar:
          </p>
          <input
            type="text"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={confirmWord}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canConfirm) void handleConfirm();
            }}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 bg-slate-50/50 rounded-b-2xl">
          <button
            type="button"
            className="btn-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-danger"
            disabled={!canConfirm || loading}
            onClick={() => void handleConfirm()}
          >
            {loading ? loadingLabel : confirmButtonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
