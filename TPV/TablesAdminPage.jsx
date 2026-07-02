"use client";

import { Bell, CheckCheck, Copy, ExternalLink, ImagePlus, Lock, Power, Trash2, Unlock } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import ConfirmModal from "./ConfirmModal";
import { applyPendingNotificationsToTables, subscribeToPendingOrderNotifications } from "./orderNotifications";

const qrLogo = {
  src: "/assets/logo-mascot.png",
  height: 38,
  width: 38,
  excavate: true,
};

const printQrLogo = {
  src: "/assets/logo-mascot.png",
  height: 34,
  width: 34,
  excavate: true,
};

const PRINT_QR_COPIES = 8;

function getFriendlyTableError(message) {
  if (message?.includes("tpv_tables_table_number_key") || message?.includes("duplicate key value")) {
    return "Ya existe una mesa con ese número.";
  }

  return message || "No se pudo crear la mesa";
}

export default function TablesAdminPage() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bulkAction, setBulkAction] = useState("");
  const [qrPopup, setQrPopup] = useState(null);
  const [qrPopupFile, setQrPopupFile] = useState(null);
  const [qrPopupSaving, setQrPopupSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [confirmModal, setConfirmModal] = useState(null);
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [tableNumberDraft, setTableNumberDraft] = useState("");
  const printRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  const origin = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  async function loadTables() {
    setLoading(true);
    setError("");

    try {
      const tablesResponse = await fetch("/api/tables", { cache: "no-store" });
      const tablesData = await tablesResponse.json();
      if (!tablesResponse.ok) throw new Error(tablesData.error || "No se pudieron cargar las mesas");
      setTables(tablesData.tables);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTables();
  }, []);

  useEffect(() => {
    async function loadQrPopup() {
      try {
        const response = await fetch("/api/settings/qr-popup", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudo cargar el popup QR");
        setQrPopup(data.popup);
      } catch (requestError) {
        showToast(requestError.message);
      }
    }

    loadQrPopup();
  }, []);

  useEffect(() => subscribeToPendingOrderNotifications((notifications) => {
    setTables((current) => applyPendingNotificationsToTables(current, notifications));
  }), []);

  useEffect(() => () => {
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
  }, []);

  function showToast(message) {
    setToast(message);

    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => setToast(""), 2600);
  }

  function getWaiterTableUrl(table) {
    return `${origin}/tpv/pedidos?mesa=${table.number}`;
  }

  function getCustomerQrUrl() {
    return `${origin}/pedido`;
  }

  async function createTable(tableNumber = "") {
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableNumber }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo crear la mesa");
      setTables((current) => [...current, data.table].sort((a, b) => a.number - b.number));
      setTableModalOpen(false);
      setTableNumberDraft("");
    } catch (requestError) {
      showToast(getFriendlyTableError(requestError.message));
    } finally {
      setSaving(false);
    }
  }

  function openTableModal() {
    setTableNumberDraft("");
    setTableModalOpen(true);
    setError("");
  }

  function closeTableModal() {
    if (saving) return;
    setTableModalOpen(false);
    setTableNumberDraft("");
  }

  async function toggleTable(table) {
    setError("");

    try {
      const response = await fetch(`/api/tables/${table.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !table.active }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo actualizar la mesa");
      setTables((current) => current.map((item) => {
        if (item.id !== table.id) return item;

        const pendingOrders = Number(item.pendingOrders ?? data.table.pendingOrders ?? 0);
        return {
          ...data.table,
          hasPendingOrders: pendingOrders > 0,
          pendingOrders,
        };
      }));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function setAllTablesActive(active) {
    setBulkAction(active ? "open" : "lock");
    setError("");

    try {
      const response = await fetch("/api/tables", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudieron actualizar las mesas");

      const updatedTables = new Map(data.tables.map((table) => [table.id, table]));
      setTables((current) => current.map((table) => {
        const updatedTable = updatedTables.get(table.id);
        if (!updatedTable) return table;

        const pendingOrders = Number(table.pendingOrders ?? updatedTable.pendingOrders ?? 0);
        return {
          ...table,
          ...updatedTable,
          pendingOrders,
          hasPendingOrders: pendingOrders > 0,
        };
      }));
      showToast(active ? "Todas las mesas están abiertas." : "Todas las mesas están bloqueadas.");
    } catch (requestError) {
      showToast(requestError.message || "No se pudieron actualizar las mesas");
    } finally {
      setBulkAction("");
    }
  }

  async function removeTable(table) {
    setError("");

    try {
      const response = await fetch(`/api/tables/${table.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo eliminar la mesa");
      setTables((current) => current.filter((item) => item.id !== table.id));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function uploadQrPopup(event) {
    event.preventDefault();
    if (!qrPopupFile) {
      showToast("Selecciona una imagen para el popup.");
      return;
    }

    setQrPopupSaving(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("image", qrPopupFile);
      const response = await fetch("/api/settings/qr-popup", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo guardar el popup QR");

      setQrPopup(data.popup);
      setQrPopupFile(null);
      showToast("Popup QR actualizado.");
    } catch (requestError) {
      showToast(requestError.message);
    } finally {
      setQrPopupSaving(false);
    }
  }

  async function removeQrPopup() {
    setQrPopupSaving(true);
    setError("");

    try {
      const response = await fetch("/api/settings/qr-popup", { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo quitar el popup QR");

      setQrPopup(data.popup);
      setQrPopupFile(null);
      showToast("Popup QR desactivado.");
    } catch (requestError) {
      showToast(requestError.message);
    } finally {
      setQrPopupSaving(false);
    }
  }

  async function copyTableUrl(table) {
    const url = getCustomerQrUrl();
    await navigator.clipboard.writeText(url);
    setCopiedId(table.id);
    window.setTimeout(() => setCopiedId(""), 1400);
  }

  async function markTableDelivered(table) {
    setError("");

    try {
      const [pendingResponse, preparingResponse] = await Promise.all([
        fetch(`/api/orders?tableNumber=${table.number}&status=pending`, { cache: "no-store" }),
        fetch(`/api/orders?tableNumber=${table.number}&status=preparing`, { cache: "no-store" }),
      ]);
      const pendingData = await pendingResponse.json();
      const preparingData = await preparingResponse.json();
      if (!pendingResponse.ok) throw new Error(pendingData.error || "No se pudieron cargar los pedidos pendientes");
      if (!preparingResponse.ok) throw new Error(preparingData.error || "No se pudieron cargar los pedidos pendientes");

      const tableOrders = [...pendingData.orders, ...preparingData.orders];
      if (tableOrders.length === 0) return;

      await Promise.all(tableOrders.map(async (order) => {
        const response = await fetch(`/api/orders/${order.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "delivered" }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudo marcar el pedido como entregado");
      }));

      setTables((current) => current.map((item) => (
        Number(item.number) === Number(table.number)
          ? { ...item, hasPendingOrders: false, pendingOrders: 0 }
          : item
      )));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  const printQrs = useReactToPrint({
    contentRef: printRef,
    documentTitle: "La Lianta - QRs mesas",
  });

  const hasTables = tables.length > 0;
  const isBusy = saving || Boolean(bulkAction);

  return (
    <>
      <header className="tpv-admin-head">
        <div>
          <p className="tpv-kicker">TPV Administración</p>
          <h1>Mesas</h1>
        </div>
        <div className="tpv-head-actions">
          <button
            className="tpv-button tpv-button-secondary"
            type="button"
            onClick={printQrs}
            disabled={!hasTables}
          >
            Imprimir QRs
          </button>
          <button
            className="tpv-button tpv-button-secondary"
            type="button"
            onClick={() => setAllTablesActive(false)}
            disabled={!hasTables || isBusy}
          >
            <Lock aria-hidden="true" size={16} strokeWidth={2.3} />
            {bulkAction === "lock" ? "Bloqueando" : "Bloquear todas"}
          </button>
          <button
            className="tpv-button tpv-button-secondary"
            type="button"
            onClick={() => setAllTablesActive(true)}
            disabled={!hasTables || isBusy}
          >
            <Unlock aria-hidden="true" size={16} strokeWidth={2.3} />
            {bulkAction === "open" ? "Abriendo" : "Abrir todas"}
          </button>
          <button className="tpv-button tpv-button-secondary" type="button" onClick={openTableModal} disabled={isBusy}>
            Nueva mesa
          </button>
          <button className="tpv-button" type="button" onClick={() => createTable()} disabled={isBusy}>
            {saving ? "Creando" : "Nueva mesa +1"}
          </button>
        </div>
      </header>

      {toast && <div className="tpv-toast" role="status">{toast}</div>}

      {error && <div className="tpv-error">{error}</div>}

      <section className="tpv-panel tpv-qr-popup-panel" aria-label="Popup para QR de clientes">
        <div className="tpv-panel-head">
          <div>
            <p className="tpv-kicker">QR clientes</p>
            <h2>Popup después de seleccionar mesa</h2>
          </div>
          <span className={qrPopup?.enabled ? "tpv-status is-active" : "tpv-status"}>
            {qrPopup?.enabled ? "Activo" : "Sin popup"}
          </span>
        </div>

        <form className="tpv-qr-popup-form" onSubmit={uploadQrPopup}>
          <label className="tpv-qr-popup-upload">
            <ImagePlus aria-hidden="true" size={18} strokeWidth={2.3} />
            <span>{qrPopupFile ? qrPopupFile.name : "Seleccionar imagen"}</span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setQrPopupFile(event.target.files?.[0] ?? null)}
              disabled={qrPopupSaving}
            />
          </label>
          <button className="tpv-button" type="submit" disabled={!qrPopupFile || qrPopupSaving}>
            {qrPopupSaving ? "Guardando..." : "Guardar popup"}
          </button>
          {qrPopup?.enabled && (
            <button className="tpv-button tpv-button-secondary" type="button" onClick={removeQrPopup} disabled={qrPopupSaving}>
              Quitar popup
            </button>
          )}
        </form>

        {qrPopup?.enabled && (
          <div className="tpv-qr-popup-preview">
            <img src={qrPopup.imageUrl} alt="Popup actual de QR" />
            <span>{qrPopup.fileName || "Imagen actual"}</span>
          </div>
        )}
      </section>

      <section className="tpv-table-card-grid" aria-label="Mesas dadas de alta">
        {loading && <article className="tpv-panel">Cargando mesas...</article>}
        {!loading && tables.length === 0 && (
          <article className="tpv-panel">Todavía no hay mesas. Crea la primera mesa.</article>
        )}
        {!loading && tables.map((table) => {
          const pendingOrdersCount = Number(table.pendingOrders ?? 0);
          const hasPendingOrders = pendingOrdersCount > 0;

          return (
            <article className={hasPendingOrders ? "tpv-panel tpv-table-card has-pending" : "tpv-panel tpv-table-card"} key={table.id}>
              <div className="tpv-table-card-head">
                <h2><span>Mesa</span> {table.number}</h2>
                <div className="tpv-table-card-states">
                  {hasPendingOrders && (
                    <span className="tpv-status is-pending" title="Pedido pendiente">
                      <Bell aria-hidden="true" size={15} strokeWidth={2.4} />
                      {pendingOrdersCount}
                    </span>
                  )}
                  <span className={table.active ? "tpv-status is-active" : "tpv-status"}>
                    {table.active ? "Activa" : "Oculta"}
                  </span>
                </div>
              </div>

              <div className="tpv-qr-box">
                {origin && (
                  <QRCodeSVG
                    value={getCustomerQrUrl()}
                    size={200}
                    level="H"
                    includeMargin
                    imageSettings={qrLogo}
                  />
                )}
              </div>

              <p className="tpv-table-url">{origin ? getCustomerQrUrl() : "/pedido"}</p>

              <a className="tpv-table-open" href={origin ? getWaiterTableUrl(table) : `/tpv/pedidos?mesa=${table.number}`}>
                Abrir TPV mesa
                <ExternalLink aria-hidden="true" size={18} strokeWidth={2.2} />
              </a>

              {hasPendingOrders && (
                <button className="tpv-table-delivered" type="button" onClick={() => markTableDelivered(table)}>
                  <CheckCheck aria-hidden="true" size={18} strokeWidth={2.3} />
                  Marcar entregado
                </button>
              )}

              <div className="tpv-row-actions tpv-table-actions">
                <button
                  type="button"
                  onClick={() => copyTableUrl(table)}
                  aria-label={`Copiar enlace de Mesa ${table.number}`}
                  title={copiedId === table.id ? "Copiado" : "Copiar enlace"}
                >
                  <Copy aria-hidden="true" size={16} strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  onClick={() => toggleTable(table)}
                  aria-label={`${table.active ? "Ocultar" : "Activar"} Mesa ${table.number}`}
                  title={table.active ? "Ocultar" : "Activar"}
                >
                  <Power aria-hidden="true" size={16} strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmModal({
                    title: "Eliminar mesa",
                    message: `Se eliminará la Mesa ${table.number}.`,
                    confirmLabel: "Eliminar",
                    onConfirm: () => removeTable(table),
                  })}
                  aria-label={`Eliminar Mesa ${table.number}`}
                  title="Eliminar"
                >
                  <Trash2 aria-hidden="true" size={16} strokeWidth={2.2} />
                </button>
              </div>
            </article>
          );
        })}
      </section>

      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel}
          onCancel={() => setConfirmModal(null)}
          onConfirm={() => {
            const action = confirmModal.onConfirm;
            setConfirmModal(null);
            action();
          }}
        />
      )}

      {tableModalOpen && (
        <div className="tpv-modal-backdrop tpv-modal-backdrop-center" role="presentation" onClick={closeTableModal}>
          <section
            className="tpv-modal-window tpv-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Nueva mesa"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="tpv-modal-head">
              <div>
                <p className="tpv-kicker">Mesas</p>
                <h2>Nueva mesa</h2>
              </div>
            </div>

            <form
              className="tpv-modal-body tpv-table-modal-form"
              onSubmit={(event) => {
                event.preventDefault();
                createTable(tableNumberDraft);
              }}
            >
              <label>
                <span>Número de mesa</span>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={tableNumberDraft}
                  onChange={(event) => setTableNumberDraft(event.target.value)}
                  placeholder="Siguiente disponible"
                />
              </label>

              <div className="tpv-modal-foot">
                <button className="tpv-button tpv-button-secondary" type="button" onClick={closeTableModal} disabled={saving}>
                  Cancelar
                </button>
                <button className="tpv-button" type="submit" disabled={saving}>
                  {saving ? "Creando..." : "Crear mesa"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      <section className="tpv-print-area" ref={printRef} aria-label="QRs imprimibles">
        {Array.from({ length: PRINT_QR_COPIES }, (_, index) => (
          <article className="tpv-print-qr" key={index}>
            <h2>La Lianta</h2>
            <QRCodeSVG
              value={origin ? getCustomerQrUrl() : "/pedido"}
              size={220}
              level="H"
              includeMargin
              imageSettings={printQrLogo}
            />
            <p>Escanea y selecciona tu mesa</p>
          </article>
        ))}
      </section>
    </>
  );
}
