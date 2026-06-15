"use client";

import { Bell, CheckCheck, Copy, ExternalLink, Power, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { applyPendingNotificationsToTables, subscribeToPendingOrderNotifications } from "./orderNotifications";

const qrLogo = {
  src: "/assets/logo-mascot.png",
  height: 68,
  width: 68,
  excavate: true,
};

const printQrLogo = {
  src: "/assets/logo-mascot.png",
  height: 68,
  width: 68,
  excavate: true,
};

export default function TablesAdminPage() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const printRef = useRef(null);

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

  useEffect(() => subscribeToPendingOrderNotifications((notifications) => {
    setTables((current) => applyPendingNotificationsToTables(current, notifications));
  }), []);

  function getWaiterTableUrl(table) {
    return `${origin}/tpv/pedidos?mesa=${table.number}`;
  }

  function getCustomerTableUrl(table) {
    return `${origin}/pedido?mesa=${table.number}`;
  }

  async function createTable() {
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/tables", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo crear la mesa");
      setTables((current) => [...current, data.table].sort((a, b) => a.number - b.number));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
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

  async function removeTable(table) {
    const confirmed = window.confirm(`Eliminar Mesa ${table.number}?`);
    if (!confirmed) return;

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

  async function copyTableUrl(table) {
    const url = getCustomerTableUrl(table);
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
            disabled={tables.length === 0}
          >
            Imprimir QRs
          </button>
          <button className="tpv-button" type="button" onClick={createTable} disabled={saving}>
            {saving ? "Creando" : "Nueva mesa +1"}
          </button>
        </div>
      </header>

      {error && <div className="tpv-error">{error}</div>}

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
                {origin && <QRCodeSVG value={getCustomerTableUrl(table)} size={180} imageSettings={qrLogo} />}
              </div>

              <p className="tpv-table-url">{origin ? getCustomerTableUrl(table) : `/pedido?mesa=${table.number}`}</p>

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
                  onClick={() => removeTable(table)}
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

      <section className="tpv-print-area" ref={printRef} aria-label="QRs imprimibles">
        {tables.filter((table) => table.active).map((table) => (
          <article className="tpv-print-qr" key={table.id}>
            <h2>Mesa {table.number}</h2>
            <QRCodeSVG
              value={origin ? getCustomerTableUrl(table) : `/pedido?mesa=${table.number}`}
              size={168}
              imageSettings={printQrLogo}
            />
            <p>Escanea para abrir pedidos</p>
          </article>
        ))}
      </section>
    </>
  );
}
