"use client";

import { BanknoteArrowDown, BanknoteArrowUp, Clock3, CreditCard, DoorClosed, DoorOpen, Eye, QrCode, ReceiptText, ShieldCheck, Wallet, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { formatPrice } from "./data";

const sessionSeed = {
  openedAt: "14/06/2026 12:02",
  openingAmount: 150,
};

const movementSeed = [
  { id: "M-01", time: "12:02", label: "Apertura de caja", kind: "entry", amount: 150 },
  { id: "M-02", time: "12:28", label: "Cobro ticket T-1576", kind: "entry", amount: 26.8 },
  { id: "M-03", time: "12:46", label: "Salida cambio proveedor", kind: "exit", amount: 24 },
  { id: "M-04", time: "13:07", label: "Cobro ticket T-1582", kind: "entry", amount: 42.8 },
];

const pendingStatuses = new Set(["pending", "preparing"]);

function isToday(value) {
  if (!value) return false;
  const date = new Date(value);
  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
}

function formatTicketTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getStatusLabel(status) {
  if (status === "paid") return "Pagado";
  if (status === "delivered") return "Entregado";
  if (status === "preparing") return "Preparando";
  if (status === "pending") return "Pendiente";
  if (status === "cancelled") return "Cancelado";
  return status || "-";
}

function mapOrderToTicket(order) {
  return {
    id: order.orderCode || order.id,
    time: formatTicketTime(order.createdAt),
    table: order.tableName || `Mesa ${order.tableNumber}`,
    type: order.source === "customer" ? "Cliente QR" : order.source === "bar" ? "Barra" : "Camarero",
    payment: "Registrado",
    total: order.total,
    status: getStatusLabel(order.status),
    items: (order.items ?? []).map((item) => ({
      name: item.productName,
      quantity: item.quantity,
      price: item.unitPrice,
    })),
  };
}

export default function CashRegisterPage() {
  const [sessionOpen, setSessionOpen] = useState(true);
  const [customerOrderingEnabled, setCustomerOrderingEnabled] = useState(true);
  const [customerOrderingSaving, setCustomerOrderingSaving] = useState(false);
  const [customerOrderingError, setCustomerOrderingError] = useState("");
  const [cashRegisterSaving, setCashRegisterSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("summary");
  const [showTotals, setShowTotals] = useState(false);
  const [previewTicket, setPreviewTicket] = useState(null);
  const [cashOrders, setCashOrders] = useState([]);
  const [cashDataLoading, setCashDataLoading] = useState(true);
  const [cashDataError, setCashDataError] = useState("");
  const [resettingTicketsScope, setResettingTicketsScope] = useState("");
  const [ticketResetMessage, setTicketResetMessage] = useState("");
  const [ticketResetError, setTicketResetError] = useState("");

  const cashDayOrders = useMemo(() => cashOrders.filter((order) => isToday(order.createdAt)), [cashOrders]);
  const cashTickets = useMemo(
    () => cashDayOrders.filter((order) => order.status === "paid" && order.total > 0).map(mapOrderToTicket),
    [cashDayOrders],
  );

  const totals = useMemo(() => {
    const paidOrders = cashDayOrders.filter((order) => order.status === "paid" && order.total > 0);
    const pendingOrders = cashDayOrders.filter((order) => pendingStatuses.has(order.status));
    const deliveredOrders = cashDayOrders.filter((order) => order.status === "delivered");
    const gross = paidOrders.reduce((sum, order) => sum + order.total, 0);
    const pending = pendingOrders.reduce((sum, order) => sum + order.total, 0);
    const delivered = deliveredOrders.reduce((sum, order) => sum + order.total, 0);

    return {
      averageTicket: paidOrders.length > 0 ? gross / paidOrders.length : 0,
      delivered,
      gross,
      paidTickets: paidOrders.length,
      pending,
      pendingOrders: pendingOrders.length,
      difference: 0,
    };
  }, [cashDayOrders]);

  const money = (value) => (showTotals ? formatPrice(value) : "*****");

  async function loadCashData() {
    setCashDataLoading(true);
    setCashDataError("");

    try {
      const response = await fetch("/api/orders?includeItems=true", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudieron cargar los tickets");
      setCashOrders(data.orders);
    } catch (requestError) {
      setCashDataError(requestError.message);
    } finally {
      setCashDataLoading(false);
    }
  }

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
    loadCashData();
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

  async function updateCashRegister(open) {
    setCashRegisterSaving(true);
    setCustomerOrderingError("");

    try {
      const response = await fetch("/api/settings/cash-register", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ open }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo actualizar el estado de caja");
      setSessionOpen(Boolean(data.cashOpen));
      setCustomerOrderingEnabled(Boolean(data.customerOrderingEnabled));
    } catch (requestError) {
      setCustomerOrderingError(requestError.message);
    } finally {
      setCashRegisterSaving(false);
    }
  }

  async function resetTickets(scope, label) {
    const confirmed = window.confirm(`Reiniciar tickets: ${label}?`);
    if (!confirmed) return;

    setResettingTicketsScope(scope);
    setTicketResetMessage("");
    setTicketResetError("");

    try {
      const response = await fetch(`/api/orders?scope=${scope}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudieron reiniciar los tickets");

      if (scope === "today" || scope === "all") {
        setPreviewTicket(null);
      }

      await loadCashData();
      setTicketResetMessage(`${data.deletedCount} tickets reiniciados.`);
    } catch (requestError) {
      setTicketResetError(requestError.message);
    } finally {
      setResettingTicketsScope("");
    }
  }

  return (
    <>
      <header className="tpv-admin-head">
        <div>
          <p className="tpv-kicker">TPV Administracion</p>
          <h1>Caja</h1>
        </div>
        <div className="tpv-head-actions">
          <button className="tpv-button tpv-button-secondary" type="button" onClick={() => setShowTotals((current) => !current)}>
            {showTotals ? "Ocultar totales" : "Mostrar totales"}
          </button>
          <button
            className={sessionOpen ? "tpv-button" : "tpv-button tpv-button-secondary"}
            type="button"
            disabled={cashRegisterSaving}
            onClick={() => updateCashRegister(!sessionOpen)}
          >
            {cashRegisterSaving ? (sessionOpen ? "Cerrando..." : "Abriendo...") : sessionOpen ? "Cerrar caja" : "Abrir caja"}
          </button>
        </div>
      </header>

      <section className="tpv-cash-hero" aria-label="Estado de caja">
        <article className="tpv-cash-status">
          <div className="tpv-cash-status-top">
            <span className={sessionOpen ? "tpv-status is-active" : "tpv-status"}>{sessionOpen ? "Caja abierta" : "Caja cerrada"}</span>
            <div className="tpv-cash-status-icon" aria-hidden="true">
              {sessionOpen ? <DoorOpen size={22} strokeWidth={2.1} /> : <DoorClosed size={22} strokeWidth={2.1} />}
            </div>
          </div>
          <div className="tpv-cash-status-main">
            <strong>{money(totals.gross)}</strong>
            <span>Total cobrado hoy desde base de datos</span>
          </div>
          <div className="tpv-cash-status-meta">
            <div>
              <Clock3 size={16} strokeWidth={2.1} />
              <span>Apertura {sessionSeed.openedAt}</span>
            </div>
            <div>
              <Wallet size={16} strokeWidth={2.1} />
              <span>Fondo inicial {money(sessionSeed.openingAmount)}</span>
            </div>
          </div>
        </article>

        <article className="tpv-cash-control">
          <div className="tpv-cash-control-head">
            <div>
              <p className="tpv-kicker">Pedidos cliente</p>
              <h2>Permitir pedidos desde QR</h2>
            </div>
          </div>
          <p className="tpv-cash-note">
            {sessionOpen
              ? customerOrderingEnabled
                ? "Los clientes pueden pedir desde el QR."
                : "Los clientes estan bloqueados aunque la caja sigue abierta."
              : "Con la caja cerrada los clientes no pueden pedir desde el QR."}
          </p>
          <div className="tpv-cash-rule-list">
            <div>
              <ShieldCheck size={16} strokeWidth={2.1} />
              <span>Caja cerrada bloquea pedidos cliente</span>
            </div>
            <div>
              <ReceiptText size={16} strokeWidth={2.1} />
              <span>Los cobros siguen quedando registrados por ticket</span>
            </div>
          </div>
          {customerOrderingError && <div className="tpv-error">{customerOrderingError}</div>}
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
        </article>
      </section>

      <section className="tpv-metrics" aria-label="Resumen de caja">
        <MetricCard icon={Wallet} label="Total cobrado" value={money(totals.gross)} detail={`${totals.paidTickets} tickets pagados`} />
        <MetricCard icon={BanknoteArrowUp} label="Pendiente" value={money(totals.pending)} detail={`${totals.pendingOrders} pedidos activos`} />
        <MetricCard icon={CreditCard} label="Entregado" value={money(totals.delivered)} detail="Pendiente de cobro" />
        <MetricCard icon={BanknoteArrowDown} label="Ticket medio" value={money(totals.averageTicket)} detail="Calculado desde DB" />
      </section>

      <section className="tpv-panel tpv-cash-workspace">
        <div className="tpv-panel-head">
          <div>
            <h2>Caja del turno</h2>
            <span className="tpv-ticket-muted">Control operativo, tickets y movimientos</span>
          </div>
          <div className="tpv-cash-ticket-tools" aria-label="Reiniciar tickets">
            <button
              className="tpv-ticket-reset"
              type="button"
              onClick={() => resetTickets("pending", "pendientes")}
              disabled={Boolean(resettingTicketsScope)}
            >
              {resettingTicketsScope === "pending" ? "Reiniciando..." : "Reiniciar pendientes"}
            </button>
            <button
              className="tpv-ticket-reset"
              type="button"
              onClick={() => resetTickets("today", "del dia")}
              disabled={Boolean(resettingTicketsScope)}
            >
              {resettingTicketsScope === "today" ? "Reiniciando..." : "Reiniciar dia"}
            </button>
            <button
              className="tpv-ticket-reset"
              type="button"
              onClick={() => resetTickets("all", "todo")}
              disabled={Boolean(resettingTicketsScope)}
            >
              {resettingTicketsScope === "all" ? "Reiniciando..." : "Reiniciar todo"}
            </button>
          </div>
        </div>

        {ticketResetMessage && <div className="tpv-ticket-muted">{ticketResetMessage}</div>}
        {ticketResetError && <div className="tpv-error">{ticketResetError}</div>}
        {cashDataError && <div className="tpv-error">{cashDataError}</div>}

        <div className="tpv-segmented" role="tablist" aria-label="Vistas de caja">
          <button className={activeTab === "summary" ? "is-active" : ""} type="button" onClick={() => setActiveTab("summary")}>
            Resumen
          </button>
          <button className={activeTab === "tickets" ? "is-active" : ""} type="button" onClick={() => setActiveTab("tickets")}>
            Tickets
          </button>
          <button className={activeTab === "movements" ? "is-active" : ""} type="button" onClick={() => setActiveTab("movements")}>
            Movimientos
          </button>
        </div>

        {activeTab === "summary" && (
          <div className="tpv-cash-grid">
            <article className="tpv-cash-card">
              <h3>Resumen operativo</h3>
              <div className="tpv-cash-list">
                <Row label="Estado de caja" value={sessionOpen ? "Abierta" : "Cerrada"} />
                <Row label="Fondo inicial" value={money(sessionSeed.openingAmount)} />
                <Row label="Total vendido" value={money(totals.gross)} />
                <Row label="Ticket medio" value={money(totals.averageTicket)} />
                <Row label="Tickets cobrados" value={String(totals.paidTickets)} />
              </div>
            </article>

            <article className="tpv-cash-card">
              <h3>Arqueo actual</h3>
              <div className="tpv-cash-list">
                <Row label="Cobrado DB" value={money(totals.gross)} />
                <Row label="Pendiente DB" value={money(totals.pending)} />
                <Row label="Entregado DB" value={money(totals.delivered)} />
                <Row label="Diferencia" value={money(totals.difference)} />
                <Row label="Pedidos cliente" value={sessionOpen && customerOrderingEnabled ? "Permitidos" : "Bloqueados"} />
              </div>
            </article>
          </div>
        )}

        {activeTab === "tickets" && (
          <>
            <div className="tpv-cash-table-wrap">
              <table className="tpv-table">
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Hora</th>
                    <th>Mesa</th>
                    <th>Tipo</th>
                    <th>Pago</th>
                    <th>Total</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cashDataLoading && (
                    <tr>
                      <td colSpan="8">Cargando tickets desde base de datos...</td>
                    </tr>
                  )}
                  {!cashDataLoading && cashTickets.length === 0 && (
                    <tr>
                      <td colSpan="8">No hay tickets para mostrar.</td>
                    </tr>
                  )}
                  {!cashDataLoading && cashTickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td>{ticket.id}</td>
                      <td>{ticket.time}</td>
                      <td>{ticket.table}</td>
                      <td>{ticket.type}</td>
                      <td>{ticket.payment}</td>
                      <td>{money(ticket.total)}</td>
                      <td><span className="tpv-status is-active">{ticket.status}</span></td>
                      <td>
                        <div className="tpv-row-actions">
                          <button
                            type="button"
                            onClick={() => setPreviewTicket(ticket)}
                            aria-label={`Previsualizar ${ticket.id}`}
                            title="Previsualizar"
                          >
                            <Eye aria-hidden="true" size={16} strokeWidth={2.2} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === "movements" && (
          <div className="tpv-cash-movement-list">
            {movementSeed.map((movement) => (
              <article className="tpv-cash-movement" key={movement.id}>
                <div className="tpv-cash-movement-main">
                  <strong>{movement.label}</strong>
                  <span>{movement.time}</span>
                </div>
                <div className="tpv-cash-movement-side">
                  <em className={movement.kind === "entry" ? "is-entry" : "is-exit"}>
                    {movement.kind === "entry" ? "Entrada" : "Salida"}
                  </em>
                  <strong>{money(movement.amount)}</strong>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {previewTicket && typeof document !== "undefined" && createPortal(
        <div className="tpv-modal-backdrop tpv-modal-backdrop-center" role="presentation" onClick={() => setPreviewTicket(null)}>
          <section
            className="tpv-modal-window tpv-modal-window-compact"
            role="dialog"
            aria-modal="true"
            aria-label={`Previsualizacion ${previewTicket.id}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="tpv-modal-head">
              <div>
                <p className="tpv-kicker">Ticket</p>
                <h2>{previewTicket.id}</h2>
              </div>
              <button className="tpv-modal-close" type="button" onClick={() => setPreviewTicket(null)} aria-label="Cerrar">
                <X aria-hidden="true" size={20} strokeWidth={2.2} />
              </button>
            </div>

            <div className="tpv-modal-body tpv-cash-preview-body">
              <TicketPreview ticket={previewTicket} />
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}

function MetricCard({ icon: Icon, label, value, detail }) {
  return (
    <article className="tpv-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
      <div className="tpv-cash-metric-icon" aria-hidden="true">
        <Icon size={18} strokeWidth={2.1} />
      </div>
    </article>
  );
}

function Row({ label, value }) {
  return (
    <div className="tpv-cash-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TicketPreview({ ticket }) {
  return (
    <article className="tpv-receipt tpv-cash-ticket-preview">
      <div className="tpv-receipt-brand">La Lianta</div>
      <div className="tpv-receipt-meta">
        <span>{ticket.id}</span>
        <strong>{ticket.table}</strong>
      </div>
      <div className="tpv-receipt-date">
        {ticket.time} - {ticket.payment} - {ticket.type}
      </div>
      <div className="tpv-receipt-rule" />
      <div className="tpv-receipt-grid tpv-receipt-grid-head">
        <span>Cant</span>
        <span>Concepto</span>
        <span>Sum.</span>
      </div>
      <div className="tpv-receipt-lines">
        {ticket.items.map((item) => (
          <div className="tpv-receipt-grid" key={`${ticket.id}-${item.name}`}>
            <span>{item.quantity} x</span>
            <span>{item.name}</span>
            <strong>{formatPrice(item.quantity * item.price)}</strong>
          </div>
        ))}
      </div>
      <div className="tpv-receipt-rule" />
      <div className="tpv-receipt-total">
        <span>Total</span>
        <strong>{formatPrice(ticket.total)}</strong>
      </div>
    </article>
  );
}
