"use client";

import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { useMemo } from "react";
import { Bar, Doughnut, Line } from "react-chartjs-2";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
);

const chartFont = {
  family: "Manrope, system-ui, sans-serif",
};

const commonOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        boxWidth: 10,
        boxHeight: 10,
        color: "#687083",
        font: chartFont,
        usePointStyle: true,
      },
    },
    tooltip: {
      backgroundColor: "#151827",
      borderColor: "rgba(255,255,255,0.12)",
      borderWidth: 1,
      padding: 12,
      titleFont: chartFont,
      bodyFont: chartFont,
    },
  },
};

const categoryColors = ["#151827", "#2f5d50", "#c99a43", "#8b5d3b", "#6f7d92", "#9a4d46"];
const statusLabels = {
  cancelled: "Cancelado",
  delivered: "Entregado",
  paid: "Pagado",
  pending: "Pendiente",
  preparing: "Preparando",
};

function getDayKey(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function getLastSevenDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    return date;
  });
}

function formatWeekday(date) {
  return new Intl.DateTimeFormat("es-ES", { weekday: "short" }).format(date);
}

export default function AdminCharts({ orders = [], products = [] }) {
  const productCategoryLookup = useMemo(() => {
    const byId = new Map();
    const byName = new Map();
    products.forEach((product) => {
      byId.set(product.id, product.category);
      byName.set(product.name, product.category);
    });
    return { byId, byName };
  }, [products]);

  const salesData = useMemo(() => {
    const days = getLastSevenDays();
    const totalsByDay = new Map(days.map((day) => [getDayKey(day), 0]));

    orders
      .filter((order) => order.status === "paid" && order.total > 0)
      .forEach((order) => {
        const key = getDayKey(new Date(order.createdAt));
        if (!totalsByDay.has(key)) return;
        totalsByDay.set(key, totalsByDay.get(key) + order.total);
      });

    return {
      labels: days.map(formatWeekday),
      datasets: [
        {
          label: "Ventas",
          data: days.map((day) => totalsByDay.get(getDayKey(day))),
          borderColor: "#151827",
          backgroundColor: "rgba(21, 24, 39, 0.1)",
          fill: true,
          tension: 0.38,
          pointRadius: 3,
          pointHoverRadius: 5,
        },
      ],
    };
  }, [orders]);

  const categoryData = useMemo(() => {
    const unitsByCategory = new Map();

    orders
      .filter((order) => order.status === "paid" && order.total > 0)
      .forEach((order) => {
        (order.items ?? []).forEach((item) => {
          const category = productCategoryLookup.byId.get(item.productId)
            || productCategoryLookup.byName.get(item.productName)
            || "Sin categoria";
          unitsByCategory.set(category, (unitsByCategory.get(category) ?? 0) + item.quantity);
        });
      });

    const entries = Array.from(unitsByCategory.entries()).sort((a, b) => b[1] - a[1]);
    const labels = entries.length > 0 ? entries.map(([category]) => category) : ["Sin datos"];

    return {
      labels,
      datasets: [
        {
          label: "Unidades",
          data: entries.length > 0 ? entries.map(([, units]) => units) : [0],
          backgroundColor: labels.map((_, index) => categoryColors[index % categoryColors.length]),
          borderRadius: 8,
          maxBarThickness: 46,
        },
      ],
    };
  }, [orders, productCategoryLookup]);

  const statusData = useMemo(() => {
    const countsByStatus = new Map();
    orders.forEach((order) => {
      countsByStatus.set(order.status, (countsByStatus.get(order.status) ?? 0) + 1);
    });

    const entries = Array.from(countsByStatus.entries()).sort((a, b) => b[1] - a[1]);
    const labels = entries.length > 0
      ? entries.map(([status]) => statusLabels[status] || status)
      : ["Sin datos"];

    return {
      labels,
      datasets: [
        {
          data: entries.length > 0 ? entries.map(([, count]) => count) : [0],
          backgroundColor: labels.map((_, index) => categoryColors[index % categoryColors.length]),
          borderColor: "#fffdf8",
          borderWidth: 4,
          hoverOffset: 8,
        },
      ],
    };
  }, [orders]);

  return (
    <section className="tpv-dashboard-grid" aria-label="Graficas del panel">
      <article className="tpv-panel tpv-chart-panel tpv-chart-panel-wide">
        <div className="tpv-panel-head">
          <div>
            <p className="tpv-kicker">Ventas</p>
            <h2>Semana actual</h2>
          </div>
        </div>
        <div className="tpv-chart-box">
          <Line
            data={salesData}
            options={{
              ...commonOptions,
              scales: {
                x: { grid: { display: false }, ticks: { color: "#687083", font: chartFont } },
                y: {
                  border: { display: false },
                  grid: { color: "rgba(21, 24, 39, 0.08)" },
                  ticks: { color: "#687083", font: chartFont },
                },
              },
            }}
          />
        </div>
      </article>

      <article className="tpv-panel tpv-chart-panel">
        <div className="tpv-panel-head">
          <div>
            <p className="tpv-kicker">Carta</p>
            <h2>Categorias</h2>
          </div>
        </div>
        <div className="tpv-chart-box">
          <Bar
            data={categoryData}
            options={{
              ...commonOptions,
              scales: {
                x: { grid: { display: false }, ticks: { color: "#687083", font: chartFont } },
                y: {
                  border: { display: false },
                  grid: { color: "rgba(21, 24, 39, 0.08)" },
                  ticks: { color: "#687083", font: chartFont, precision: 0 },
                },
              },
            }}
          />
        </div>
      </article>

      <article className="tpv-panel tpv-chart-panel">
        <div className="tpv-panel-head">
          <div>
            <p className="tpv-kicker">Caja</p>
            <h2>Estados pedidos</h2>
          </div>
        </div>
        <div className="tpv-chart-box">
          <Doughnut
            data={statusData}
            options={{
              ...commonOptions,
              cutout: "68%",
            }}
          />
        </div>
      </article>
    </section>
  );
}
