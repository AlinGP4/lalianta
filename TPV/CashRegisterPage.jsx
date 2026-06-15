"use client";

import { BanknoteArrowDown, BanknoteArrowUp, Clock3, CreditCard, DoorClosed, DoorOpen, QrCode, ReceiptText, ShieldCheck, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { formatPrice } from "./data";

const sessionSeed = {
  openedAt: "14/06/2026 12:02",
  openingAmount: 150,
  cashSales: 286.4,
  cardSales: 418.3,
  payouts: 24,
  paidTickets: 37,
  averageTicket: 19.05,
};

const ticketSeed = [
  { id: "T-1582", time: "13:07", table: "Mesa 4", type: "Completo", payment: "Tarjeta", total: 42.8, status: "Pagado" },
  { id: "T-1581", time: "12:54", table: "Mesa 7", type: "Por separado", payment: "Efectivo", total: 18.4, status: "Pagado" },
  { id: "T-1580", time: "12:41", table: "Mesa 1", type: "Completo", payment: "Tarjeta", total: 33.2, status: "Pagado" },
  { id: "T-1579", time: "12:35", table: "Mesa 7", type: "Por separado", payment: "Efectivo", total: 14.6, status: "Pagado" },
];

const movementSeed = [
  { id: "M-01", time: "12:02", label: "Apertura de caja", kind: "entry", amount: 150 },
  { id: "M-02", time: "12:28", label: "Cobro ticket T-1576", kind: "entry", amount: 26.8 },
  { id: "M-03", time: "12:46", label: "Salida cambio proveedor", kind: "exit", amount: 24 },
  { id: "M-04", time: "13:07", label: "Cobro ticket T-1582", kind: "entry", amount: 42.8 },
];

export default function CashRegisterPage() {
  const [sessionOpen, setSessionOpen] = useState(true);
  const [customerOrderingEnabled, setCustomerOrderingEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState("summary");
  const [showTotals, setShowTotals] = useState(false);

  const totals = useMemo(() => {
    const gross = sessionSeed.cashSales + sessionSeed.cardSales;
    const cashInDrawer = sessionSeed.openingAmount + sessionSeed.cashSales - sessionSeed.payouts;

    return {
      gross,
      cashInDrawer,
      difference: 0,
    };
  }, []);

  const money = (value) => (showTotals ? formatPrice(value) : "*****");

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
            className={sessionOpen ? "tpv-button tpv-button-secondary" : "tpv-button"}
            type="button"
            onClick={() => setSessionOpen(true)}
          >
            Abrir caja
          </button>
          <button
            className={sessionOpen ? "tpv-button" : "tpv-button tpv-button-secondary"}
            type="button"
            onClick={() => setSessionOpen(false)}
          >
            Cerrar caja
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
            <strong>{money(totals.cashInDrawer)}</strong>
            <span>Disponible estimado en caja</span>
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
          <button
            className={customerOrderingEnabled && sessionOpen ? "tpv-cash-qr-button is-active" : "tpv-cash-qr-button"}
            type="button"
            aria-pressed={customerOrderingEnabled && sessionOpen}
            disabled={!sessionOpen}
            onClick={() => setCustomerOrderingEnabled((current) => !current)}
          >
            <QrCode size={18} strokeWidth={2.1} />
            <span>
              {sessionOpen
                ? customerOrderingEnabled
                  ? "Bloquear pedidos desde QR"
                  : "Permitir pedidos desde QR"
                : "Caja cerrada: QR bloqueado"}
            </span>
          </button>
        </article>
      </section>

      <section className="tpv-metrics" aria-label="Resumen de caja">
        <MetricCard icon={Wallet} label="Total turno" value={money(totals.gross)} detail={`${sessionSeed.paidTickets} tickets cobrados`} />
        <MetricCard icon={BanknoteArrowUp} label="Efectivo" value={money(sessionSeed.cashSales)} detail="Entradas del turno" />
        <MetricCard icon={CreditCard} label="Tarjeta" value={money(sessionSeed.cardSales)} detail="Cobros terminal" />
        <MetricCard icon={BanknoteArrowDown} label="Salidas" value={money(sessionSeed.payouts)} detail={`Diferencia ${money(totals.difference)}`} />
      </section>

      <section className="tpv-panel tpv-cash-workspace">
        <div className="tpv-panel-head">
          <div>
            <h2>Caja del turno</h2>
            <span className="tpv-ticket-muted">Control operativo, tickets y movimientos</span>
          </div>
        </div>

        <div className="tpv-cash-tabs" role="tablist" aria-label="Vistas de caja">
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
                <Row label="Ticket medio" value={money(sessionSeed.averageTicket)} />
                <Row label="Tickets cobrados" value={String(sessionSeed.paidTickets)} />
              </div>
            </article>

            <article className="tpv-cash-card">
              <h3>Arqueo actual</h3>
              <div className="tpv-cash-list">
                <Row label="Efectivo esperado" value={money(totals.cashInDrawer)} />
                <Row label="Tarjeta acumulada" value={money(sessionSeed.cardSales)} />
                <Row label="Salidas registradas" value={money(sessionSeed.payouts)} />
                <Row label="Diferencia" value={money(totals.difference)} />
                <Row label="Pedidos cliente" value={sessionOpen && customerOrderingEnabled ? "Permitidos" : "Bloqueados"} />
              </div>
            </article>
          </div>
        )}

        {activeTab === "tickets" && (
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
                </tr>
              </thead>
              <tbody>
                {ticketSeed.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>{ticket.id}</td>
                    <td>{ticket.time}</td>
                    <td>{ticket.table}</td>
                    <td>{ticket.type}</td>
                    <td>{ticket.payment}</td>
                    <td>{money(ticket.total)}</td>
                    <td><span className="tpv-status is-active">{ticket.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
