"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AdminCharts from "./AdminCharts";
import { formatPrice } from "./data";

const openStatuses = new Set(["pending", "preparing", "delivered"]);
const kitchenStatuses = new Set(["pending", "preparing"]);

function isToday(value) {
  if (!value) return false;
  const date = new Date(value);
  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
}

export default function AdminDashboard() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      setError("");

      try {
        const [ordersResponse, productsResponse] = await Promise.all([
          fetch("/api/orders?includeItems=true", { cache: "no-store" }),
          fetch("/api/products?includeInactive=true", { cache: "no-store" }),
        ]);
        const ordersData = await ordersResponse.json();
        const productsData = await productsResponse.json();
        if (!ordersResponse.ok) throw new Error(ordersData.error || "No se pudieron cargar los pedidos");
        if (!productsResponse.ok) throw new Error(productsData.error || "No se pudieron cargar los productos");
        setOrders(ordersData.orders);
        setProducts(productsData.products);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  const metrics = useMemo(() => {
    const todayPaidOrders = orders.filter((order) => order.status === "paid" && order.total > 0 && isToday(order.createdAt));
    const revenue = todayPaidOrders.reduce((sum, order) => sum + order.total, 0);
    const averageTicket = todayPaidOrders.length > 0 ? revenue / todayPaidOrders.length : 0;
    const openOrders = orders.filter((order) => openStatuses.has(order.status));
    const kitchenOrders = orders.filter((order) => kitchenStatuses.has(order.status));
    const activeProducts = products.filter((product) => product.active);
    const activeCategories = new Set(activeProducts.map((product) => product.category).filter(Boolean));

    return {
      activeCategories: activeCategories.size,
      activeProducts: activeProducts.length,
      averageTicket,
      kitchenOrders: kitchenOrders.length,
      openOrders: openOrders.length,
      paidTickets: todayPaidOrders.length,
      revenue,
    };
  }, [orders, products]);

  return (
    <>
      <header className="tpv-admin-head">
        <div>
          <p className="tpv-kicker">TPV Administracion</p>
          <h1>Panel de control</h1>
        </div>
        <div className="tpv-head-actions">
          <Link className="tpv-button tpv-button-secondary" href="/tpv">Cambiar vista</Link>
        </div>
      </header>

      {error && <div className="tpv-error">{error}</div>}

      <section className="tpv-metrics" aria-label="Resumen">
        <Metric label="Ventas hoy" value={loading ? "Cargando" : formatPrice(metrics.revenue)} detail={`${metrics.paidTickets} tickets pagados`} />
        <Metric label="Ticket medio" value={loading ? "Cargando" : formatPrice(metrics.averageTicket)} detail="Calculado desde DB" />
        <Metric label="Pedidos abiertos" value={loading ? "..." : String(metrics.openOrders)} detail={`${metrics.kitchenOrders} en cocina`} />
        <Metric label="Productos activos" value={loading ? "..." : String(metrics.activeProducts)} detail={`${metrics.activeCategories} categorias`} />
      </section>

      <AdminCharts orders={orders} products={products} />
    </>
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
