"use client";

import { CheckCheck, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { categories, formatPrice, products } from "./data";

const pendingStatuses = new Set(["pending", "preparing"]);

function formatTicketDate(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function TicketReceipt({ order, action }) {
  const repeatedProducts = new Set(
    (order.items ?? [])
      .map((item) => item.productName)
      .filter((name, index, names) => names.indexOf(name) !== index),
  );

  return (
    <article className={order.status === "delivered" || order.status === "paid" ? "tpv-receipt is-delivered" : "tpv-receipt"}>
      <div className="tpv-receipt-brand">La Lianta</div>
      <div className="tpv-receipt-meta">
        <span>Mesa</span>
        <strong>{order.tableNumber}</strong>
      </div>
      <div className="tpv-receipt-date">{formatTicketDate(order.createdAt)}</div>
      <div className="tpv-receipt-rule" />
      <div className="tpv-receipt-grid tpv-receipt-grid-head">
        <span>Cant</span>
        <span>Concepto</span>
        <span>Sum.</span>
      </div>
      <div className="tpv-receipt-lines">
        {(order.items ?? []).map((item) => (
          <div className="tpv-receipt-grid" key={item.id ?? `${item.productName}-${item.source}-${item.unitPriceCents}`}>
            <span>{item.quantity} x</span>
            <span>
              {item.productName}
              {repeatedProducts.has(item.productName) && (
                <em>{item.source === "customer" ? "Cliente" : "Camarero"}</em>
              )}
            </span>
            <strong>{formatPrice(item.quantity * item.unitPrice)}</strong>
          </div>
        ))}
      </div>
      <div className="tpv-receipt-rule" />
      <div className="tpv-receipt-total">
        <span>Total</span>
        <strong>{formatPrice(order.total)}</strong>
      </div>
      {action}
    </article>
  );
}

function mergeOrdersByStatus(orders, status) {
  const matchingOrders = orders.filter((order) => order.status === status);
  const mergedItems = new Map();

  matchingOrders.forEach((order) => {
    (order.items ?? []).forEach((item) => {
      const key = `${item.productName}|${item.source}|${item.unitPriceCents}`;
      const current = mergedItems.get(key);
      if (current) {
        mergedItems.set(key, {
          ...current,
          quantity: current.quantity + item.quantity,
        });
      } else {
        mergedItems.set(key, { ...item });
      }
    });
  });

  const items = Array.from(mergedItems.values());

  return {
    createdAt: matchingOrders.at(-1)?.createdAt,
    items,
    status,
    tableNumber: matchingOrders[0]?.tableNumber,
    total: items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
  };
}

function getReceiptItemKey(item) {
  return `${item.productName}|${item.source}|${item.unitPriceCents}`;
}

function buildSeparateTicket(order, selectedItems) {
  const items = (order.items ?? []).flatMap((item) => {
    const key = getReceiptItemKey(item);
    const selectedQuantity = selectedItems[key] ?? 0;
    if (selectedQuantity <= 0) return [];

    return [{
      ...item,
      quantity: Math.min(item.quantity, selectedQuantity),
    }];
  });

  return {
    ...order,
    items,
    total: items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
  };
}

function SplitSelectableReceipt({ order, selectedItems, mode, onLineClick, emptyLabel }) {
  const repeatedProducts = new Set(
    (order.items ?? [])
      .map((item) => item.productName)
      .filter((name, index, names) => names.indexOf(name) !== index),
  );

  return (
    <article className="tpv-receipt">
      <div className="tpv-receipt-brand">La Lianta</div>
      <div className="tpv-receipt-meta">
        <span>Mesa</span>
        <strong>{order.tableNumber}</strong>
      </div>
      <div className="tpv-receipt-date">{formatTicketDate(order.createdAt)}</div>
      <div className="tpv-receipt-rule" />
      <div className="tpv-receipt-grid tpv-receipt-grid-head">
        <span>Cant</span>
        <span>Concepto</span>
        <span>Sum.</span>
      </div>
      <div className="tpv-receipt-lines">
        {(order.items ?? []).length === 0 && (
          <span className="tpv-ticket-muted">{emptyLabel}</span>
        )}
        {(order.items ?? []).map((item) => {
          const key = getReceiptItemKey(item);
          const selectedQuantity = selectedItems[key] ?? 0;
          const visibleQuantity = mode === "source"
            ? Math.max(item.quantity - selectedQuantity, 0)
            : Math.min(item.quantity, selectedQuantity);

          if (visibleQuantity <= 0) return null;

          return (
            <button
              className="tpv-receipt-grid tpv-receipt-grid-button"
              type="button"
              key={key}
              onClick={() => onLineClick(item)}
            >
              <span>{visibleQuantity} x</span>
              <span>
                {item.productName}
                {repeatedProducts.has(item.productName) && (
                  <em>{item.source === "customer" ? "Cliente" : "Camarero"}</em>
                )}
              </span>
              <strong>{formatPrice(visibleQuantity * item.unitPrice)}</strong>
            </button>
          );
        })}
      </div>
      <div className="tpv-receipt-rule" />
      <div className="tpv-receipt-total">
        <span>Total</span>
        <strong>{formatPrice(
          (order.items ?? []).reduce((sum, item) => {
            const key = getReceiptItemKey(item);
            const selectedQuantity = selectedItems[key] ?? 0;
            const visibleQuantity = mode === "source"
              ? Math.max(item.quantity - selectedQuantity, 0)
              : Math.min(item.quantity, selectedQuantity);
            return sum + visibleQuantity * item.unitPrice;
          }, 0),
        )}</strong>
      </div>
    </article>
  );
}

export default function OrdersMobile({ initialTableNumber = "" }) {
  const [selectedTable, setSelectedTable] = useState(initialTableNumber);
  const [tables, setTables] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todo");
  const [waiterTicket, setWaiterTicket] = useState([]);
  const [sendingWaiterTicket, setSendingWaiterTicket] = useState(false);
  const [loading, setLoading] = useState(!initialTableNumber);
  const [error, setError] = useState("");
  const [tableOrders, setTableOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ticketTab, setTicketTab] = useState("pending");
  const [paymentMode, setPaymentMode] = useState("full");
  const [splitCount, setSplitCount] = useState(2);
  const [separateSelection, setSeparateSelection] = useState({});
  const [separateModalOpen, setSeparateModalOpen] = useState(false);
  const [settlingPayment, setSettlingPayment] = useState(false);

  const filteredTables = useMemo(() => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return tables;

    return tables.filter((table) => String(table.number).includes(normalizedQuery));
  }, [query, tables]);

  const filteredProducts = useMemo(() => {
    if (category === "Todo") return products;
    return products.filter((product) => product.category === category);
  }, [category]);

  const waiterTotal = waiterTicket.reduce((sum, item) => sum + item.qty * item.price, 0);
  const deliveredTicket = useMemo(() => mergeOrdersByStatus(tableOrders, "delivered"), [tableOrders]);
  const paidTicket = useMemo(() => mergeOrdersByStatus(tableOrders, "paid"), [tableOrders]);
  const splitTotal = splitCount > 0 ? deliveredTicket.total / splitCount : deliveredTicket.total;
  const separateTicket = useMemo(
    () => buildSeparateTicket(deliveredTicket, separateSelection),
    [deliveredTicket, separateSelection],
  );

  useEffect(() => {
    if (selectedTable) return;

    async function loadTables() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/tables?includeInactive=false", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudieron cargar las mesas");
        setTables(data.tables);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    }

    loadTables();
  }, [selectedTable]);

  useEffect(() => {
    if (!selectedTable || ticketTab !== "pending") return undefined;

    const eventSource = new EventSource(`/api/orders/stream?tableNumber=${selectedTable}`);

    eventSource.addEventListener("orders", (event) => {
      const data = JSON.parse(event.data);
      setTableOrders(data.orders);
      setOrdersLoading(false);
    });

    eventSource.addEventListener("error", () => {
      eventSource.close();
    });

    return () => eventSource.close();
  }, [selectedTable, ticketTab]);

  useEffect(() => {
    if (!selectedTable) return;

    async function loadTableOrders() {
      setOrdersLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/orders?tableNumber=${selectedTable}&includeItems=true`,
          { cache: "no-store" },
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudieron cargar los pedidos de la mesa");
        setTableOrders(data.orders);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setOrdersLoading(false);
      }
    }

    loadTableOrders();
  }, [selectedTable]);

  useEffect(() => {
    setSeparateSelection({});
  }, [selectedTable, deliveredTicket.total]);

  async function markDelivered(order) {
    setError("");

    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "delivered" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo marcar como entregado");
      setTableOrders((current) => current.map((item) => (
        item.id === order.id ? { ...item, ...data.order, items: item.items ?? [] } : item
      )));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function markDeliveredAsPaid() {
    const deliveredOrders = tableOrders.filter((order) => order.status === "delivered");
    if (deliveredOrders.length === 0) return;

    setError("");
    setSettlingPayment(true);

    try {
      const results = await Promise.all(
        deliveredOrders.map(async (order) => {
          const response = await fetch(`/api/orders/${order.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "paid" }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "No se pudo marcar como pagado");
          return data.order;
        }),
      );

      const updatedById = new Map(results.map((order) => [order.id, order]));
      setTableOrders((current) => current.map((order) => {
        const updatedOrder = updatedById.get(order.id);
        if (!updatedOrder) return order;

        return {
          ...order,
          ...updatedOrder,
          items: order.items ?? [],
        };
      }));
      setSeparateSelection({});
      setSeparateModalOpen(false);
      setPaymentMode("full");
      setTicketTab("paid");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSettlingPayment(false);
    }
  }

  function addWaiterProduct(product) {
    setTicketTab("pending");
    setWaiterTicket((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }

      return [...current, { ...product, qty: 1 }];
    });
  }

  function removeWaiterProduct(productId) {
    setWaiterTicket((current) => current.flatMap((item) => {
      if (item.id !== productId) return [item];
      if (item.qty <= 1) return [];
      return [{ ...item, qty: item.qty - 1 }];
    }));
  }

  async function sendWaiterTicket() {
    if (waiterTicket.length === 0) return;

    setSendingWaiterTicket(true);
    setError("");

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableNumber: selectedTable,
          source: "waiter",
          items: waiterTicket.map((item) => ({
            productName: item.name,
            quantity: item.qty,
            price: item.price,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo anadir el producto");

      setTableOrders((current) => {
        const withoutUpdatedOrder = current.filter((order) => order.id !== data.order.id);
        return [data.order, ...withoutUpdatedOrder];
      });
      setWaiterTicket([]);
      setTicketTab("pending");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSendingWaiterTicket(false);
    }
  }

  function addSeparateItem(item) {
    const key = getReceiptItemKey(item);
    setSeparateSelection((current) => {
      const currentQty = current[key] ?? 0;
      if (currentQty >= item.quantity) return current;
      return { ...current, [key]: currentQty + 1 };
    });
  }

  function removeSeparateItem(item) {
    const key = getReceiptItemKey(item);
    setSeparateSelection((current) => {
      const currentQty = current[key] ?? 0;
      if (currentQty <= 1) {
        const next = { ...current };
        delete next[key];
        return next;
      }

      return { ...current, [key]: currentQty - 1 };
    });
  }

  function openSeparateModal() {
    setPaymentMode("separate");
    setSeparateModalOpen(true);
  }

  function closeSeparateModal() {
    setSeparateModalOpen(false);
    setPaymentMode("full");
  }

  async function handleSeparatePayment() {
    if (separateTicket.items.length === 0) return;
    setError("");
    setSettlingPayment(true);

    try {
      const response = await fetch("/api/orders/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableNumber: selectedTable,
          items: separateTicket.items.map((item) => ({
            productName: item.productName,
            quantity: item.quantity,
            source: item.source,
            unitPriceCents: item.unitPriceCents,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo cobrar la seleccion");

      setTableOrders(data.orders);
      setSeparateSelection({});
      setSeparateModalOpen(false);
      setPaymentMode("full");
      setTicketTab("paid");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSettlingPayment(false);
    }
  }

  if (!selectedTable) {
    return (
      <main className="tpv-phone tpv-phone-tables">
        <header className="tpv-phone-head">
          <a className="tpv-phone-back" href="/tpv" aria-label="Volver">{"<"}</a>
          <div>
            <p className="tpv-kicker">TPV Pedidos</p>
            <h1>Mesas</h1>
          </div>
          <a className="tpv-phone-admin" href="/tpv/admin">Admin</a>
        </header>

        <section className="tpv-table-search" aria-label="Buscar mesa">
          <Search aria-hidden="true" size={18} strokeWidth={2.2} />
          <input
            inputMode="numeric"
            placeholder="Buscar numero de mesa"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </section>

        {error && <div className="tpv-error">{error}</div>}

        <section className="tpv-mobile-table-grid" aria-label="Mesas activas">
          {loading && <div className="tpv-mobile-empty">Cargando mesas...</div>}
          {!loading && filteredTables.length === 0 && (
            <div className="tpv-mobile-empty">No hay mesas activas con ese numero.</div>
          )}
          {!loading && filteredTables.map((table) => (
            <button
              className="tpv-mobile-table"
              type="button"
              key={table.id}
              onClick={() => {
                setSelectedTable(String(table.number));
                window.history.replaceState(null, "", `/tpv/pedidos?mesa=${table.number}`);
              }}
            >
              <span>Mesa</span>
              <strong>{table.number}</strong>
            </button>
          ))}
        </section>
      </main>
    );
  }

  return (
    <main className="tpv-phone tpv-waiter-order">
      <header className="tpv-phone-head">
        <button
          className="tpv-phone-back"
          type="button"
          onClick={() => {
            setSelectedTable("");
            window.history.replaceState(null, "", "/tpv/pedidos");
          }}
          aria-label="Ver mesas"
        >
          {"<"}
        </button>
        <div>
          <p className="tpv-kicker">TPV Pedidos</p>
          <h1>Mesa {selectedTable}</h1>
        </div>
        <a className="tpv-phone-admin" href="/tpv/admin">Admin</a>
      </header>

      {error && <div className="tpv-error">{error}</div>}

      <div className="tpv-waiter-layout">
        <section className="tpv-waiter-picker" aria-label="Seleccion de productos">
          <section className="tpv-mobile-tabs" aria-label="Categorias">
            {categories.map((item) => (
              <button
                className={item === category ? "is-active" : ""}
                type="button"
                key={item}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </section>

          <section className="tpv-product-grid" aria-label="Productos">
            {filteredProducts.map((product) => (
              <button
                className="tpv-product-tile"
                type="button"
                key={product.id}
                onClick={() => addWaiterProduct(product)}
              >
                <span>{product.category}</span>
                <strong>{product.name}</strong>
                <em>{formatPrice(product.price)}</em>
              </button>
            ))}
          </section>
        </section>

        <aside className="tpv-ticket" aria-label="Ticket actual">
          <div className="tpv-ticket-head">
            <strong>Ticket mesa {selectedTable}</strong>
            <span>{tableOrders.filter((order) => pendingStatuses.has(order.status)).length} pendientes</span>
          </div>

          <div className="tpv-ticket-tabs" role="tablist" aria-label="Estado de pedidos">
            <button
              className={ticketTab === "pending" ? "is-active" : ""}
              type="button"
              onClick={() => setTicketTab("pending")}
            >
              Pendientes
            </button>
            <button
              className={ticketTab === "delivered" ? "is-active" : ""}
              type="button"
              onClick={() => setTicketTab("delivered")}
            >
              Entregados
            </button>
            <button
              className={ticketTab === "paid" ? "is-active" : ""}
              type="button"
              onClick={() => setTicketTab("paid")}
            >
              Pagados
            </button>
          </div>

          <div className="tpv-ticket-block">
            {ticketTab === "pending" && (
              <>
                {waiterTicket.length > 0 && (
                  <div className="tpv-ticket-selection">
                    <p>Seleccion actual</p>
                    <div className="tpv-ticket-lines">
                      {waiterTicket.map((item) => (
                        <button
                          className="tpv-ticket-line tpv-ticket-line-button"
                          type="button"
                          key={item.id}
                          onClick={() => removeWaiterProduct(item.id)}
                          title="Quitar 1"
                        >
                          <span>{item.qty}x {item.name}</span>
                          <strong>{formatPrice(item.qty * item.price)}</strong>
                        </button>
                      ))}
                    </div>
                    <div className="tpv-ticket-total">
                      <span>Total seleccion</span>
                      <strong>{formatPrice(waiterTotal)}</strong>
                    </div>
                    <button
                      className="tpv-button"
                      type="button"
                      onClick={sendWaiterTicket}
                      disabled={sendingWaiterTicket}
                    >
                      {sendingWaiterTicket ? "Anadiendo" : "Anadir a pendientes"}
                    </button>
                  </div>
                )}

                <p>Pedidos pendientes</p>
                {ordersLoading && <span className="tpv-ticket-muted">Cargando pedidos...</span>}
                {!ordersLoading && tableOrders.filter((order) => pendingStatuses.has(order.status)).length === 0 && (
                  <span className="tpv-ticket-muted">Sin pedidos pendientes.</span>
                )}
                {!ordersLoading && tableOrders.filter((order) => pendingStatuses.has(order.status)).map((order) => (
                  <TicketReceipt
                    key={order.id}
                    order={order}
                    action={(
                      <button className="tpv-table-order-done" type="button" onClick={() => markDelivered(order)}>
                        <CheckCheck aria-hidden="true" size={17} strokeWidth={2.3} />
                        Marcar entregado
                      </button>
                    )}
                  />
                ))}
              </>
            )}

            {ticketTab === "delivered" && (
              <>
                <p>Pedidos entregados</p>
                {ordersLoading && <span className="tpv-ticket-muted">Cargando pedidos...</span>}
                {!ordersLoading && deliveredTicket.items.length === 0 && (
                  <span className="tpv-ticket-muted">Todavia no hay entregados.</span>
                )}
                {!ordersLoading && deliveredTicket.items.length > 0 && (
                  <>
                    <TicketReceipt key="delivered-ticket" order={deliveredTicket} />
                    <div className="tpv-payment-box">
                      <div className="tpv-payment-actions" aria-label="Opciones de cobro">
                        <button
                          className={paymentMode === "full" ? "tpv-payment-button is-active" : "tpv-payment-button"}
                          type="button"
                          onClick={() => setPaymentMode("full")}
                        >
                          Pagar todo
                        </button>
                        <button
                          className={paymentMode === "split" ? "tpv-payment-button is-active" : "tpv-payment-button"}
                          type="button"
                          onClick={() => setPaymentMode("split")}
                        >
                          Dividir
                        </button>
                        <button
                          className={separateModalOpen ? "tpv-payment-button is-active" : "tpv-payment-button"}
                          type="button"
                          onClick={openSeparateModal}
                        >
                          Por separado
                        </button>
                      </div>

                      {paymentMode === "full" && (
                        <div className="tpv-payment-stack">
                          <div className="tpv-payment-summary">
                            <span>Total a cobrar</span>
                            <strong>{formatPrice(deliveredTicket.total)}</strong>
                          </div>
                          <button
                            className="tpv-button"
                            type="button"
                            onClick={markDeliveredAsPaid}
                            disabled={settlingPayment}
                          >
                            {settlingPayment ? "Pagando..." : "Pagar"}
                          </button>
                        </div>
                      )}

                      {paymentMode === "split" && (
                        <div className="tpv-payment-split">
                          <div className="tpv-payment-stepper" aria-label="Dividir cuenta">
                            <button
                              type="button"
                              onClick={() => setSplitCount((current) => Math.max(2, current - 1))}
                            >
                              -
                            </button>
                            <div>
                              <span>Personas</span>
                              <strong>{splitCount}</strong>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSplitCount((current) => Math.min(12, current + 1))}
                            >
                              +
                            </button>
                          </div>
                          <div className="tpv-payment-summary">
                            <span>Importe por persona</span>
                            <strong>{formatPrice(splitTotal)}</strong>
                          </div>
                        </div>
                      )}

                    </div>
                  </>
                )}
              </>
            )}

            {ticketTab === "paid" && (
              <>
                <p>Tickets pagados</p>
                {ordersLoading && <span className="tpv-ticket-muted">Cargando tickets...</span>}
                {!ordersLoading && paidTicket.items.length === 0 && (
                  <span className="tpv-ticket-muted">Todavia no hay tickets pagados.</span>
                )}
                {!ordersLoading && paidTicket.items.length > 0 && (
                  <TicketReceipt key="paid-ticket" order={paidTicket} />
                )}
              </>
            )}
          </div>
        </aside>
      </div>

      {separateModalOpen && (
        <div className="tpv-modal-backdrop" role="presentation" onClick={closeSeparateModal}>
          <section
            className="tpv-modal-window"
            role="dialog"
            aria-modal="true"
            aria-label="Cobro por separado"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="tpv-modal-head">
              <div>
                <p className="tpv-kicker">Cobro</p>
                <h2>Por separado</h2>
              </div>
              <button className="tpv-modal-close" type="button" onClick={closeSeparateModal} aria-label="Cerrar">
                <X aria-hidden="true" size={20} strokeWidth={2.2} />
              </button>
            </div>

            <div className="tpv-modal-body">
              <div className="tpv-payment-separate">
                <div className="tpv-payment-separate-grid">
                  <div className="tpv-payment-ticket-column">
                    <p>Ticket completo</p>
                    <SplitSelectableReceipt
                      order={deliveredTicket}
                      selectedItems={separateSelection}
                      mode="source"
                      onLineClick={addSeparateItem}
                      emptyLabel="No quedan lineas por mover."
                    />
                  </div>

                  <div className="tpv-payment-ticket-column">
                    <p>Ticket separado</p>
                    <SplitSelectableReceipt
                      order={deliveredTicket}
                      selectedItems={separateSelection}
                      mode="target"
                      onLineClick={removeSeparateItem}
                      emptyLabel="Aun no has separado nada."
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="tpv-modal-foot">
              <button
                className="tpv-button"
                type="button"
                onClick={handleSeparatePayment}
                disabled={separateTicket.items.length === 0 || settlingPayment}
              >
                {settlingPayment ? "Pagando..." : "Pagar"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
