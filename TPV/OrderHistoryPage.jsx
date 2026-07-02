"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ConfirmModal from "./ConfirmModal";
import { formatPrice } from "./data";

const areaLabels = {
  kitchen: "Cocina",
  bar: "Barra",
};

const paymentMethodLabels = {
  card: "tarjeta",
  cash: "efectivo",
};

function formatOrderDate(value) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getStatusLabel(status) {
  if (status === "completed") return "Completado";
  return "Pendiente";
}

function getAreaStatus(order, area) {
  return area === "bar" ? order.barStatus : order.kitchenStatus;
}

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState([]);
  const [paymentRequests, setPaymentRequests] = useState([]);
  const [activeArea, setActiveArea] = useState("kitchen");
  const [allowedArea, setAllowedArea] = useState(null);
  const [activeTab, setActiveTab] = useState("pending");
  const [sessionRole, setSessionRole] = useState("");
  const [sessionLoading, setSessionLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState("");
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resettingHistory, setResettingHistory] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudo comprobar la sesión");

        const nextAllowedArea = data.user?.historyArea === "bar" || data.user?.historyArea === "kitchen"
          ? data.user.historyArea
          : null;
        if (!ignore) {
          setSessionRole(data.user?.role ?? "");
          setAllowedArea(nextAllowedArea);
          if (nextAllowedArea) setActiveArea(nextAllowedArea);
        }
      } catch (requestError) {
        if (!ignore) {
          setError(requestError.message);
          setLoading(false);
        }
      } finally {
        if (!ignore) setSessionLoading(false);
      }
    }

    loadSession();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || sessionLoading) return undefined;

    setLoading(true);
    const eventSource = new EventSource(`/api/orders/stream?area=${activeArea}`);

    function handleOrders(event) {
      const data = JSON.parse(event.data);
      setOrders(data.orders);
      setPaymentRequests(data.paymentRequests ?? []);
      setLoading(false);
      setError("");
    }

    function handleStreamError() {
      setLoading(false);
      setError("No se pudo conectar el historico en tiempo real");
    }

    eventSource.addEventListener("orders", handleOrders);
    eventSource.addEventListener("error", handleStreamError);

    return () => {
      eventSource.close();
    };
  }, [activeArea, sessionLoading]);

  const sortedOrders = useMemo(
    () => [...orders].sort((first, second) => new Date(first.createdAt) - new Date(second.createdAt)),
    [orders],
  );

  const pendingOrders = useMemo(
    () => sortedOrders.filter((order) => getAreaStatus(order, activeArea) !== "completed"),
    [activeArea, sortedOrders],
  );

  const completedOrders = useMemo(
    () => sortedOrders.filter((order) => getAreaStatus(order, activeArea) === "completed"),
    [activeArea, sortedOrders],
  );

  const visibleOrders = activeTab === "pending" ? pendingOrders : completedOrders;

  async function markCompleted(order) {
    if (getAreaStatus(order, activeArea) === "completed" || updatingOrderId) return;

    setUpdatingOrderId(order.id);
    setError("");

    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area: activeArea, areaStatus: "completed" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo completar el pedido");

      setOrders((currentOrders) => currentOrders.map((currentOrder) => (
        currentOrder.id === order.id
          ? { ...currentOrder, ...data.order, items: currentOrder.items }
          : currentOrder
      )));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUpdatingOrderId("");
    }
  }

  async function resetAllHistory() {
    setResettingHistory(true);
    setError("");

    try {
      const response = await fetch("/api/orders?scope=all", { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo reiniciar el histórico");

      setOrders([]);
      setResetModalOpen(false);
      setToast("Históricos reiniciados.");
      window.setTimeout(() => setToast(""), 2200);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setResettingHistory(false);
    }
  }

  const isAdmin = sessionRole === "admin";
  const homeHref = sessionRole === "camarero" ? "/tpv/pedidos" : "/tpv";
  const homeLabel = sessionRole === "camarero" ? "Mesas" : "Inicio TPV";

  return (
    <main className="tpv-page tpv-history-page">
      <section className="tpv-history-shell">
      <header className="tpv-admin-head">
        <div>
          <p className="tpv-kicker">TPV Histórico</p>
          <h1>{areaLabels[activeArea]}</h1>
        </div>
        <div className="tpv-head-actions">
          <Link className="tpv-button tpv-button-secondary" href={homeHref}>{homeLabel}</Link>
          {isAdmin && (
            <button
              className="tpv-button tpv-button-danger"
              type="button"
              onClick={() => setResetModalOpen(true)}
              disabled={resettingHistory}
            >
              <Trash2 aria-hidden="true" size={16} strokeWidth={2.3} />
              {resettingHistory ? "Reiniciando" : "Reiniciar histórico"}
            </button>
          )}
        </div>
      </header>

      {toast && <div className="tpv-toast" role="status">{toast}</div>}

      {error && <div className="tpv-error">{error}</div>}

      <section className="tpv-panel tpv-history-panel">
        {paymentRequests.length > 0 && (
          <div className="tpv-payment-request-list" aria-label="Avisos de pago">
            {paymentRequests.map((request) => (
              <div className="tpv-payment-request-alert" key={request.id}>
                <div>
                  <strong>Mesa {request.tableNumber} quiere pagar con {paymentMethodLabels[request.paymentMethod] ?? "pago"}</strong>
                  <span>{request.scope === "partial" ? "Puede ser pago parcial" : "Caja confirma si pagan todo o parte"}</span>
                </div>
                <em>{formatPrice(request.total)}</em>
              </div>
            ))}
          </div>
        )}

        {!allowedArea && (
          <div className="tpv-segmented tpv-history-tabs" role="tablist" aria-label="Historico por zona">
            <button
              className={activeArea === "kitchen" ? "is-active" : ""}
              type="button"
              onClick={() => setActiveArea("kitchen")}
            >
              Cocina
            </button>
            <button
              className={activeArea === "bar" ? "is-active" : ""}
              type="button"
              onClick={() => setActiveArea("bar")}
            >
              Barra
            </button>
          </div>
        )}

        <div className="tpv-segmented tpv-history-tabs" role="tablist" aria-label="Historico de pedidos">
          <button
            className={activeTab === "pending" ? "is-active" : ""}
            type="button"
            onClick={() => setActiveTab("pending")}
          >
            Pendiente ({pendingOrders.length})
          </button>
          <button
            className={activeTab === "completed" ? "is-active" : ""}
            type="button"
            onClick={() => setActiveTab("completed")}
          >
            Completado ({completedOrders.length})
          </button>
        </div>

        <div className="tpv-history-list" aria-live="polite">
          {(sessionLoading || loading) && <div className="tpv-history-empty">Cargando pedidos...</div>}
          {!loading && visibleOrders.length === 0 && (
            <div className="tpv-history-empty">No hay pedidos en este estado.</div>
          )}
          {!loading && visibleOrders.map((order) => {
            const areaStatus = getAreaStatus(order, activeArea);
            const isPending = areaStatus !== "completed";
            const isUpdating = updatingOrderId === order.id;

            return (
            <button
              className={isPending ? "tpv-history-order is-clickable" : "tpv-history-order"}
              key={order.id}
              type="button"
              disabled={!isPending || isUpdating}
              onClick={() => markCompleted(order)}
            >
              <div className="tpv-history-order-head">
                <div>
                  <strong>{order.tableName || `Mesa ${order.tableNumber || "-"}`}</strong>
                  <span>{formatOrderDate(order.createdAt)}</span>
                </div>
                <span className={isPending ? "tpv-status is-pending" : "tpv-status is-active"}>
                  {isUpdating ? "Completando..." : getStatusLabel(areaStatus)}
                </span>
              </div>

              <div className="tpv-history-items">
                {(order.items ?? []).length === 0 && <span>Sin líneas de pedido.</span>}
                {(order.items ?? []).map((item) => (
                  <div className="tpv-history-item" key={item.id ?? `${order.id}-${item.productName}`}>
                    <span>{item.quantity} x</span>
                    <strong>{item.productName}</strong>
                  </div>
                ))}
              </div>
            </button>
            );
          })}
        </div>
      </section>
      </section>
      {resetModalOpen && (
        <ConfirmModal
          title="Reiniciar históricos"
          message="Se borrarán todos los pedidos del histórico de cocina y barra. Esta acción no se puede deshacer."
          confirmLabel={resettingHistory ? "Reiniciando..." : "Reiniciar"}
          onCancel={() => {
            if (!resettingHistory) setResetModalOpen(false);
          }}
          onConfirm={resetAllHistory}
        />
      )}
    </main>
  );
}
