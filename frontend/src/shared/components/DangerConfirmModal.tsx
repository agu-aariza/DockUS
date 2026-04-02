import { useEffect, useState } from 'react';

interface DangerConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmWord: string;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}

export function DangerConfirmModal({
  open,
  title,
  description,
  confirmWord,
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
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <h3>{title}</h3>
        <p>{description}</p>
        <p>
          Escribe <strong>{confirmWord}</strong> para confirmar.
        </p>
        <input
          type="text"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder={confirmWord}
        />
        <div className="row end gap-8">
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn danger"
            disabled={!canConfirm || loading}
            onClick={handleConfirm}
          >
            {loading ? 'Procesando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
