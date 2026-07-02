"use client";

import { X } from "lucide-react";

export default function ConfirmModal({
  cancelLabel = "Cancelar",
  confirmLabel = "Confirmar",
  message,
  onCancel,
  onConfirm,
  title = "Confirmar acción",
}) {
  return (
    <div className="tpv-modal-backdrop tpv-modal-backdrop-center" role="presentation" onClick={onCancel}>
      <section
        className="tpv-modal-window tpv-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="tpv-modal-head">
          <div>
            <p className="tpv-kicker">Confirmación</p>
            <h2>{title}</h2>
          </div>
          <button className="tpv-modal-close" type="button" onClick={onCancel} aria-label="Cerrar">
            <X aria-hidden="true" size={20} strokeWidth={2.2} />
          </button>
        </div>

        <div className="tpv-modal-body">
          <p className="tpv-confirm-message">{message}</p>
        </div>

        <div className="tpv-modal-foot">
          <button className="tpv-button tpv-button-secondary" type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className="tpv-button tpv-button-danger" type="button" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
