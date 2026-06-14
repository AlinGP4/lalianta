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

const salesData = {
  labels: ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"],
  datasets: [
    {
      label: "Ventas",
      data: [420, 510, 460, 690, 840, 1180, 960],
      borderColor: "#151827",
      backgroundColor: "rgba(21, 24, 39, 0.1)",
      fill: true,
      tension: 0.38,
      pointRadius: 3,
      pointHoverRadius: 5,
    },
  ],
};

const categoryData = {
  labels: ["Vinos", "Cervezas", "Copas", "Comida"],
  datasets: [
    {
      label: "Unidades",
      data: [32, 46, 28, 18],
      backgroundColor: ["#151827", "#2f5d50", "#c99a43", "#8b5d3b"],
      borderRadius: 8,
      maxBarThickness: 46,
    },
  ],
};

const paymentData = {
  labels: ["Tarjeta", "Efectivo", "Invitacion"],
  datasets: [
    {
      data: [68, 27, 5],
      backgroundColor: ["#2f5d50", "#151827", "#c99a43"],
      borderColor: "#fffdf8",
      borderWidth: 4,
      hoverOffset: 8,
    },
  ],
};

export default function AdminCharts() {
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
            <h2>Metodos de pago</h2>
          </div>
        </div>
        <div className="tpv-chart-box">
          <Doughnut
            data={paymentData}
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
