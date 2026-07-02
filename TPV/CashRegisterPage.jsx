"use client";

import { QrCode } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const openStatuses = new Set(["pending", "preparing", "delivered"]);
const pendingStatuses = new Set(["pending", "preparing"]);

export default function CashRegisterPage() {
  const [sessionOpen, setSessionOpen] = useState(true);
  const [customerOrderingEnabled, setCustomerOrderingEnabled] = useState(true);
  const [customerOrderingSaving, setCustomerOrderingSaving] = useState(false);
  const [customerOrderingError, setCustomerOrderingError] = useState("");
  const [cashRegisterSaving, setCashRegisterSaving] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");

  const orderCounts = useMemo(() => {
    const openTables = new Set(
      orders
        .filter((order) => openStatuses.has(order.status) && order.tableNumber)
        .map((order) => order.tableNumber),
    );
    const pendingOrders = orders.filter((order) => pendingStatuses.has(order.status));

    return {
      openTables: openTables.size,
      pendingOrders: pendingOrders.length,
      totalOrders: orders.length,
    };
  }, [orders]);

  useEffect(() => {
    async function loadCustomerOrderingSetting() {
      try {
        const response = await fetch("/api/settings/customer-ordering", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudo cargar el estado de pedidos QR");
        setSessionOpen(Boolean(data.cashOpen));
        setCustomerOrderingEnabled(Boolean(data.customerOrderingEnabled));
      } catch (requestError) {
        setCustomerOrderingError(requestError.message);
      }
    }

    loadCustomerOrderingSetting();
  }, []);

  useEffect(() => {
    async function loadOrders() {
      setOrdersLoading(true);
      setOrdersError("");

      try {
        const response = await fetch("/api/orders", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudieron cargar los pedidos");
        setOrders(data.orders);
      } catch (requestError) {
        setOrdersError(requestError.message);
      } finally {
        setOrdersLoading(false);
      }
    }

    loadOrders();
  }, []);

  async function toggleCustomerOrdering() {
    const nextEnabled = !customerOrderingEnabled;
    setCustomerOrderingSaving(true);
    setCustomerOrderingError("");

    try {
      const response = await fetch("/api/settings/customer-ordering", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo actualizar el estado de pedidos QR");
      setSessionOpen(Boolean(data.cashOpen));
      setCustomerOrderingEnabled(Boolean(data.customerOrderingEnabled));
    } catch (requestError) {
      setCustomerOrderingError(requestError.message);
    } finally {
      setCustomerOrderingSaving(false);
    }
  }

  async function setCashRegisterState(open) {
    setCashRegisterSaving(true);
    setCustomerOrderingError("");

    try {
      const response = await fetch("/api/settings/cash-register", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ open }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `No se pudo ${open ? "abrir" : "cerrar"} la caja`);
      setSessionOpen(Boolean(data.cashOpen));
      setCustomerOrderingEnabled(Boolean(data.customerOrderingEnabled));
    } catch (requestError) {
      setCustomerOrderingError(requestError.message);
    } finally {
      setCashRegisterSaving(false);
    }
  }

  return (
    <>
      <header className="tpv-admin-head">
        <div>
          <p className="tpv-kicker">TPV Administración</p>
          <h1>Caja</h1>
        </div>
        <div className="tpv-head-actions">
          <button
            className={sessionOpen ? "tpv-button tpv-button-danger" : "tpv-button"}
            type="button"
            disabled={cashRegisterSaving}
            onClick={() => setCashRegisterState(!sessionOpen)}
          >
            {cashRegisterSaving
              ? sessionOpen
                ? "Cerrando..."
                : "Abriendo..."
              : sessionOpen
              ? "Cerrar caja"
              : "Abrir caja"}
          </button>
        </div>
      </header>

      <section className="tpv-metrics" aria-label="Resumen operativo de pedidos">
        <CountCard label="Mesas abiertas" value={ordersLoading ? "..." : String(orderCounts.openTables)} detail="Con pedidos activos" />
        <CountCard label="Pedidos pendientes" value={ordersLoading ? "..." : String(orderCounts.pendingOrders)} detail="Pendientes o preparando" />
        <CountCard label="Pedidos totales" value={ordersLoading ? "..." : String(orderCounts.totalOrders)} detail="Registrados en TPV" />
      </section>

      <section className="tpv-panel tpv-cash-workspace" aria-label="Controles de caja">
        {customerOrderingError && <div className="tpv-error">{customerOrderingError}</div>}
        {ordersError && <div className="tpv-error">{ordersError}</div>}

        <button
          className={customerOrderingEnabled && sessionOpen ? "tpv-cash-qr-button is-active" : "tpv-cash-qr-button"}
          type="button"
          aria-pressed={customerOrderingEnabled && sessionOpen}
          disabled={!sessionOpen || customerOrderingSaving}
          onClick={toggleCustomerOrdering}
        >
          <QrCode size={18} strokeWidth={2.1} />
          <span>
            {customerOrderingSaving
              ? "Guardando..."
              : sessionOpen
              ? customerOrderingEnabled
                ? "Bloquear pedidos desde QR"
                : "Permitir pedidos desde QR"
              : "Caja cerrada: QR bloqueado"}
          </span>
        </button>
      </section>
    </>
  );
}

function CountCard({ label, value, detail }) {
  return (
    <article className="tpv-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}
