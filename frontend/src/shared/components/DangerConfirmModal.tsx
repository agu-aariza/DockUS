/**
 * Modal reutilizable para operaciones destructivas.
 *
 * Muestra una tarjeta con confirmación visual clara para reducir borrados
 * accidentales en pantallas operativas.
 */

import { useEffect, useRef, useState } from 'react';
import { RiAlertFill, RiCloseLine } from 'react-icons/ri';
import { Button } from './ui/Button';
import { useFocusTrap } from '../hooks/useFocusTrap';

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
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useFocusTrap<HTMLDivElement>(open, inputRef);

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
      {/* Backdrop: el equivalente de teclado de "clic fuera para cerrar" es
          Escape, ya gestionado arriba — no necesita foco ni rol propios. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm transition-opacity"
        onClick={() => { if (!loading) onCancel(); }}
      />

      {/* Card */}
      <div
        ref={dialogRef}
        className="relative z-10 w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-md"
      >
        {/* Header */}
        <div className="flex items-start gap-4 border-b border-slate-100 px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-50 border border-danger-100">
            <RiAlertFill className="text-xl text-danger-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-500 leading-relaxed">{description}</p>
          </div>
          <button
            className="shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:outline-none"
            onClick={onCancel}
            disabled={loading}
            aria-label="Cerrar"
          >
            <RiCloseLine className="text-xl" />
          </button>
        </div>

        {/* Confirm input */}
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-slate-500">
            Escribe <code className="rounded bg-danger-50 border border-danger-100 px-1.5 py-0.5 text-xs font-semibold text-danger-700">{confirmWord}</code> para confirmar:
          </p>
          <input
            ref={inputRef}
            type="text"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={confirmWord}
            className="input-field"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canConfirm) void handleConfirm();
            }}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 bg-slate-50/50 rounded-b-lg">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={!canConfirm || loading}
            onClick={() => void handleConfirm()}
          >
            {loading ? loadingLabel : confirmButtonLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
