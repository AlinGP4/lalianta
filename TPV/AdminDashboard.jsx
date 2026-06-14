import AdminCharts from "./AdminCharts";
import AdminShell from "./AdminShell";
import { categories, formatPrice, openOrders, products } from "./data";

const revenue = 846.7;
const averageTicket = 18.4;
const activeProducts = products.filter((product) => product.active).length;

export default function AdminDashboard() {
  return (
    <AdminShell active="panel">
      <header className="tpv-admin-head">
        <div>
          <p className="tpv-kicker">TPV Administracion</p>
          <h1>Panel de control</h1>
        </div>
        <div className="tpv-head-actions">
          <a className="tpv-button tpv-button-secondary" href="/tpv">Cambiar vista</a>
        </div>
      </header>

      <section className="tpv-metrics" aria-label="Resumen">
        <Metric label="Ventas hoy" value={formatPrice(revenue)} detail="43 tickets" />
        <Metric label="Ticket medio" value={formatPrice(averageTicket)} detail="+6% vs ayer" />
        <Metric label="Pedidos abiertos" value={String(openOrders.length)} detail="2 en cocina" />
        <Metric label="Productos activos" value={String(activeProducts)} detail={`${categories.length - 1} categorias`} />
      </section>

      <AdminCharts />
    </AdminShell>
  );
}

function Metric({ label, value, detail }) {
  return (
    <article className="tpv-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}
