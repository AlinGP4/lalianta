"use client";

import { Ban, CheckCircle2, Minus, Plus, ReceiptText, Search, ShoppingCart, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { pruneCartByVisibleProducts, subscribeToCatalogChanges } from "./catalogRealtime";
import ConfirmModal from "./ConfirmModal";
import { formatPrice } from "./data";
import LogoutButton from "./LogoutButton";
import { applyPendingNotificationsToTables, subscribeToPendingOrderNotifications } from "./orderNotifications";

const pendingStatuses = new Set(["pending", "preparing"]);
const paymentMethodLabels = {
  card: "tarjeta",
  cash: "efectivo",
};

function isCubataProduct(product) {
  return product.category?.toLocaleLowerCase("es-ES") === "cubata" || product.name?.toLocaleLowerCase("es-ES") === "cubata";
}

function buildCubataItem(product, alcoholProduct, refrescoProduct) {
  return {
    ...product,
    alcoholProductId: alcoholProduct.id,
    id: `${product.id}:${alcoholProduct.id}:${refrescoProduct.id}`,
    name: `${product.name} - ${alcoholProduct.name} + ${refrescoProduct.name}`,
    productId: product.id,
    refrescoProductId: refrescoProduct.id,
  };
}

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

function TicketReceipt({ action, draftQuantities = {}, editable = false, onItemQuantityChange, order }) {
  const repeatedProducts = new Set(
    (order.items ?? [])
      .map((item) => item.productName)
      .filter((name, index, names) => names.indexOf(name) !== index),
  );
  const receiptTotal = editable
    ? (order.items ?? []).reduce((sum, item) => {
      const quantity = draftQuantities[item.id] ?? item.quantity;
      return sum + quantity * item.unitPrice;
    }, 0)
    : order.total;

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
        {(order.items ?? []).map((item) => {
          const quantity = editable ? draftQuantities[item.id] ?? item.quantity : item.quantity;

          return (
          <div className={editable ? "tpv-receipt-grid tpv-receipt-grid-edit" : "tpv-receipt-grid"} key={item.id ?? `${item.productName}-${item.source}-${item.unitPriceCents}`}>
            <span>{quantity} x</span>
            <span>
              {item.productName}
              {repeatedProducts.has(item.productName) && (
                <em>{item.source === "customer" ? "Cliente" : "Camarero"}</em>
              )}
            </span>
            <div className="tpv-receipt-line-total">
              <strong>{formatPrice(quantity * item.unitPrice)}</strong>
              {editable && (
                <div className="tpv-receipt-edit-controls" aria-label={`Editar ${item.productName}`}>
                  <button
                    type="button"
                    onClick={() => onItemQuantityChange?.(item, quantity - 1)}
                    aria-label={quantity === 1 ? `Eliminar ${item.productName}` : `Quitar ${item.productName}`}
                  >
                    <Minus aria-hidden="true" size={13} strokeWidth={2.4} />
                  </button>
                  <span>{quantity}</span>
                  <button
                    type="button"
                    onClick={() => onItemQuantityChange?.(item, quantity + 1)}
                    aria-label={`Añadir ${item.productName}`}
                  >
                    <Plus aria-hidden="true" size={13} strokeWidth={2.4} />
                  </button>
                </div>
              )}
            </div>
          </div>
          );
        })}
      </div>
      <div className="tpv-receipt-rule" />
      <div className="tpv-receipt-total">
        <span>Total</span>
        <strong>{formatPrice(receiptTotal)}</strong>
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

function WaiterMainTabs({ activeTab, onChange }) {
  return (
    <div className="tpv-segmented tpv-waiter-main-tabs" role="tablist" aria-label="TPV Camarero">
      <button
        className={activeTab === "tables" ? "is-active" : ""}
        type="button"
        onClick={() => onChange("tables")}
      >
        Mesas
      </button>
      <button
        className={activeTab === "products" ? "is-active" : ""}
        type="button"
        onClick={() => onChange("products")}
      >
        Productos
      </button>
    </div>
  );
}

function StockManagementSection({
  categories,
  category,
  filteredProducts,
  onCategoryChange,
  onToggleSoldOut,
  productsLoading,
  updatingStockProductId,
}) {
  return (
    <section className="tpv-waiter-stock-panel" aria-label="Gestión rápida de productos">
      <section className="tpv-scroll-tabs" aria-label="Categorías">
        {categories.map((item) => (
          <button
            className={item === category ? "is-active" : ""}
            type="button"
            key={item}
            onClick={() => onCategoryChange(item)}
          >
            {item}
          </button>
        ))}
      </section>

      <section className="tpv-product-grid" aria-label="Productos">
        {productsLoading && <div className="tpv-mobile-empty">Cargando productos...</div>}
        {!productsLoading && filteredProducts.length === 0 && (
          <div className="tpv-mobile-empty">No hay productos disponibles.</div>
        )}
        {filteredProducts.map((product) => (
          <article className={product.soldOut ? "tpv-stock-card is-sold-out" : "tpv-stock-card"} key={product.id}>
            <div>
              <span>{product.category}</span>
              <strong>{product.name}</strong>
              <em>{formatPrice(product.price)}</em>
            </div>
            <button
              className={product.soldOut ? "tpv-waiter-stock-button is-available" : "tpv-waiter-stock-button"}
              type="button"
              onClick={() => onToggleSoldOut(product)}
              disabled={updatingStockProductId === product.id}
              aria-label={`${product.soldOut ? "Marcar disponible" : "Marcar agotado"} ${product.name}`}
              title={product.soldOut ? "Marcar disponible" : "Marcar agotado"}
            >
              {product.soldOut ? (
                <CheckCircle2 aria-hidden="true" size={15} strokeWidth={2.2} />
              ) : (
                <Ban aria-hidden="true" size={15} strokeWidth={2.2} />
              )}
              {updatingStockProductId === product.id ? "..." : product.soldOut ? "Disponible" : "Agotar"}
            </button>
          </article>
        ))}
      </section>
    </section>
  );
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
  const [waiterCartOpen, setWaiterCartOpen] = useState(false);
  const [waiterTicketOpen, setWaiterTicketOpen] = useState(false);
  const [sendingWaiterTicket, setSendingWaiterTicket] = useState(false);
  const [loading, setLoading] = useState(!initialTableNumber);
  const [error, setError] = useState("");
  const [tableOrders, setTableOrders] = useState([]);
  const [paymentRequests, setPaymentRequests] = useState([]);
  const [productList, setProductList] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [waiterMainTab, setWaiterMainTab] = useState("tables");
  const [ticketTab, setTicketTab] = useState("pending");
  const [paymentMode, setPaymentMode] = useState("full");
  const [splitCount, setSplitCount] = useState(2);
  const [separateSelection, setSeparateSelection] = useState({});
  const [separateModalOpen, setSeparateModalOpen] = useState(false);
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [tableNameDraft, setTableNameDraft] = useState("");
  const [creatingTable, setCreatingTable] = useState(false);
  const [settlingPayment, setSettlingPayment] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState("");
  const [orderItemDraft, setOrderItemDraft] = useState({});
  const [savingOrderEdit, setSavingOrderEdit] = useState(false);
  const [updatingStockProductId, setUpdatingStockProductId] = useState("");
  const [resettingOrders, setResettingOrders] = useState(false);
  const [cubataDraft, setCubataDraft] = useState(null);
  const [cubataConfigs, setCubataConfigs] = useState([]);
  const [confirmModal, setConfirmModal] = useState(null);

  async function loadProductCatalog({ showLoading = false } = {}) {
    if (showLoading) setProductsLoading(true);
    setError("");

    try {
      const [productsResponse, cubatasResponse] = await Promise.all([
        fetch("/api/products?includeInactive=false", { cache: "no-store" }),
        fetch("/api/cubatas", { cache: "no-store" }),
      ]);
      const productsData = await productsResponse.json();
      const cubatasData = await cubatasResponse.json();
      if (!productsResponse.ok) throw new Error(productsData.error || "No se pudieron cargar los productos");
      if (!cubatasResponse.ok) throw new Error(cubatasData.error || "No se pudo cargar el modo cubata");
      setProductList(productsData.products);
      setCubataConfigs(cubatasData.configs);
      setWaiterTicket((current) => pruneCartByVisibleProducts(current, productsData.products));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      if (showLoading) setProductsLoading(false);
    }
  }

  const filteredTables = useMemo(() => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return tables;

    return tables.filter((table) => String(table.number).includes(normalizedQuery));
  }, [query, tables]);
  const pendingTables = useMemo(
    () => tables.filter((table) => table.pendingOrders > 0),
    [tables],
  );
  const pendingOrdersTotal = pendingTables.reduce((total, table) => total + table.pendingOrders, 0);
  const pendingOrdersLabel = pendingOrdersTotal === 1 ? "1 pedido sin hacer" : `${pendingOrdersTotal} pedidos sin hacer`;

  const categories = useMemo(() => (
    ["Todo", ...Array.from(new Set(productList.map((product) => product.category)))]
  ), [productList]);

  const filteredProducts = useMemo(() => {
    if (category === "Todo") return productList;
    return productList.filter((product) => product.category === category);
  }, [category, productList]);
  const alcoholProducts = useMemo(
    () => productList.filter((product) => product.active && product.category?.toLocaleLowerCase("es-ES") === "alcohol"),
    [productList],
  );
  const refrescoProducts = useMemo(
    () => productList.filter((product) => product.active && product.category?.toLocaleLowerCase("es-ES") === "refresco"),
    [productList],
  );
  const cubataRefrescoProducts = useMemo(() => {
    if (!cubataDraft?.alcoholProductId) return refrescoProducts;

    const config = cubataConfigs.find((item) => item.alcoholProductId === cubataDraft.alcoholProductId);
    if (!config || config.mixerProductIds.length === 0) return refrescoProducts;

    return config.mixerProductIds
      .map((id) => refrescoProducts.find((product) => product.id === id))
      .filter(Boolean);
  }, [cubataConfigs, cubataDraft?.alcoholProductId, refrescoProducts]);
  const selectedCubataAlcohol = useMemo(
    () => alcoholProducts.find((product) => product.id === cubataDraft?.alcoholProductId),
    [alcoholProducts, cubataDraft?.alcoholProductId],
  );
  const selectedCubataRefresco = useMemo(
    () => cubataRefrescoProducts.find((product) => product.id === cubataDraft?.refrescoProductId),
    [cubataRefrescoProducts, cubataDraft?.refrescoProductId],
  );
  const cubataStep = cubataDraft?.step ?? "alcohol";

  const waiterTotal = waiterTicket.reduce((sum, item) => sum + item.qty * item.price, 0);
  const waiterLineCount = waiterTicket.reduce((sum, item) => sum + item.qty, 0);
  const deliveredTicket = useMemo(() => mergeOrdersByStatus(tableOrders, "delivered"), [tableOrders]);
  const paidTicket = useMemo(() => mergeOrdersByStatus(tableOrders, "paid"), [tableOrders]);
  const tablePaymentRequest = useMemo(
    () => paymentRequests.find((request) => Number(request.tableNumber) === Number(selectedTable)) ?? null,
    [paymentRequests, selectedTable],
  );
  const selectedTableInfo = useMemo(
    () => tables.find((table) => Number(table.number) === Number(selectedTable)) ?? null,
    [selectedTable, tables],
  );
  const selectedTableLabel = selectedTableInfo?.name ?? `Mesa ${selectedTable}`;
  const splitTotal = splitCount > 0 ? deliveredTicket.total / splitCount : deliveredTicket.total;
  const separateTicket = useMemo(
    () => buildSeparateTicket(deliveredTicket, separateSelection),
    [deliveredTicket, separateSelection],
  );

  async function loadTables({ showLoading = false } = {}) {
    if (showLoading) setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/tables", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudieron cargar las mesas");
      setTables(data.tables);
      return data.tables;
    } catch (requestError) {
      setError(requestError.message);
      return [];
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    loadProductCatalog({ showLoading: true });
  }, []);

  useEffect(() => (
    subscribeToCatalogChanges(() => {
      loadProductCatalog();
    })
  ), []);

  useEffect(() => {
    if (selectedTable) return;
    loadTables({ showLoading: true });
  }, [selectedTable]);

  useEffect(() => {
    if (selectedTable) return undefined;

    return subscribeToPendingOrderNotifications((notifications) => {
      loadTables().then((freshTables) => {
        setTables((current) => applyPendingNotificationsToTables(freshTables.length > 0 ? freshTables : current, notifications));
      });
    });
  }, [selectedTable]);

  useEffect(() => {
    if (!selectedTable || ticketTab !== "pending") return undefined;

    const eventSource = new EventSource(`/api/orders/stream?tableNumber=${selectedTable}`);

    eventSource.addEventListener("orders", (event) => {
      const data = JSON.parse(event.data);
      setTableOrders(data.orders);
      setPaymentRequests(data.paymentRequests ?? []);
      setOrdersLoading(false);
    });

    eventSource.addEventListener("error", () => {
      eventSource.close();
    });

    return () => eventSource.close();
  }, [selectedTable, ticketTab]);

  async function loadTableOrders() {
    if (!selectedTable) return;

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

  useEffect(() => {
    if (!selectedTable) return;

    loadTableOrders();
  }, [selectedTable]);

  useEffect(() => {
    setSeparateSelection({});
  }, [selectedTable, deliveredTicket.total]);

  useEffect(() => {
    cancelEditOrder();
  }, [selectedTable, ticketTab]);

  function startEditOrder(order) {
    setEditingOrderId(order.id);
    setOrderItemDraft(Object.fromEntries((order.items ?? []).map((item) => [item.id, item.quantity])));
    setError("");
  }

  function cancelEditOrder() {
    setEditingOrderId("");
    setOrderItemDraft({});
  }

  function changeOrderItemDraft(item, quantity) {
    if (!item?.id) return;

    setOrderItemDraft((current) => ({
      ...current,
      [item.id]: Math.max(0, Number(quantity)),
    }));
  }

  async function confirmEditOrder(order) {
    if (!order?.id || savingOrderEdit) return;

    setSavingOrderEdit(true);
    setError("");

    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: (order.items ?? []).map((item) => ({
            id: item.id,
            quantity: orderItemDraft[item.id] ?? item.quantity,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo editar el pedido");

      setTableOrders((current) => {
        if (data.order.status === "cancelled") {
          return current.filter((currentOrder) => currentOrder.id !== data.order.id);
        }

        return current.map((currentOrder) => (
          currentOrder.id === data.order.id ? data.order : currentOrder
        ));
      });
      cancelEditOrder();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingOrderEdit(false);
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

  function addWaiterItem(product) {
    if (product.soldOut) return;

    setTicketTab("pending");
    setWaiterTicket((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }

      return [...current, { ...product, qty: 1 }];
    });
  }

  async function toggleWaiterProductSoldOut(product) {
    if (updatingStockProductId) return;

    setUpdatingStockProductId(product.id);
    setError("");

    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ soldOut: !product.soldOut }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo actualizar el producto");

      setProductList((current) => current.map((item) => (
        item.id === data.product.id ? data.product : item
      )));
      if (!data.product.active || data.product.soldOut) {
        setWaiterTicket((current) => current.filter((item) => (item.productId ?? item.id) !== data.product.id));
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUpdatingStockProductId("");
    }
  }

  function addWaiterProduct(product) {
    if (product.soldOut) return;

    if (isCubataProduct(product) && !product.alcoholProductId && !product.refrescoProductId) {
      setCubataDraft({
        alcoholProductId: "",
        product,
        refrescoProductId: "",
        step: "alcohol",
      });
      return;
    }

    addWaiterItem(product);
  }

  function selectCubataAlcohol(productId) {
    setCubataDraft((current) => current ? {
      ...current,
      alcoholProductId: productId,
      refrescoProductId: "",
      step: "refresco",
    } : current);
  }

  function selectCubataRefresco(productId) {
    setCubataDraft((current) => current ? {
      ...current,
      refrescoProductId: productId,
      step: "confirm",
    } : current);
  }

  function moveCubataStep(step) {
    setCubataDraft((current) => current ? { ...current, step } : current);
  }

  function confirmCubata() {
    if (!cubataDraft?.alcoholProductId || !cubataDraft?.refrescoProductId) return;
    const alcoholProduct = alcoholProducts.find((product) => product.id === cubataDraft.alcoholProductId);
    const refrescoProduct = cubataRefrescoProducts.find((product) => product.id === cubataDraft.refrescoProductId);
    if (!alcoholProduct || !refrescoProduct) return;

    addWaiterItem(buildCubataItem(cubataDraft.product, alcoholProduct, refrescoProduct));
    setCubataDraft(null);
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
            alcoholProductId: item.alcoholProductId,
            productId: item.productId ?? item.id,
            quantity: item.qty,
            refrescoProductId: item.refrescoProductId,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo añadir el producto");

      setTableOrders((current) => {
        const withoutUpdatedOrder = current.filter((order) => order.id !== data.order.id);
        return [data.order, ...withoutUpdatedOrder];
      });
      setWaiterTicket([]);
      setWaiterCartOpen(false);
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
      if (!response.ok) throw new Error(data.error || "No se pudo cobrar la selección");

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

  async function resetTableOrders() {
    setResettingOrders(true);
    setError("");

    try {
      const response = await fetch(`/api/orders?tableNumber=${selectedTable}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudieron reiniciar los pedidos");

      setTableOrders([]);
      setWaiterTicket([]);
      setSeparateSelection({});
      setSeparateModalOpen(false);
      setPaymentMode("full");
      setTicketTab("pending");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setResettingOrders(false);
    }
  }

  async function createWaiterTable() {
    const tableName = tableNameDraft.trim();
    if (!tableName) {
      setError("Pon un nombre para la mesa.");
      return;
    }

    setCreatingTable(true);
    setError("");

    try {
      const response = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableName }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo crear la mesa");

      const tableNumber = String(data.table.number);
      setTables((current) => [...current, data.table].sort((first, second) => Number(first.number) - Number(second.number)));
      setSelectedTable(tableNumber);
      setTableModalOpen(false);
      setTableNameDraft("");
      window.history.replaceState(null, "", `/tpv/pedidos?mesa=${tableNumber}`);
    } catch (requestError) {
      setError(requestError.message);
      await loadTables();
    } finally {
      setCreatingTable(false);
    }
  }

  async function openWaiterTable(table) {
    const tableNumber = String(table.number);
    setSelectedTable(tableNumber);
    window.history.replaceState(null, "", `/tpv/pedidos?mesa=${tableNumber}`);

    if (!table.hasWaiterCall) return;

    try {
      await fetch(`/api/waiter-calls?tableNumber=${tableNumber}`, { method: "DELETE" });
      setTables((current) => current.map((item) => (
        Number(item.number) === Number(tableNumber)
          ? { ...item, hasWaiterCall: false, waiterCall: null }
          : item
      )));
    } catch {
      // The next notification refresh will restore the marker if it could not be cleared.
    }
  }

  if (!selectedTable) {
    return (
      <main className="tpv-phone tpv-phone-tables">
        <header className="tpv-phone-head">
          <Link className="tpv-phone-home" href="/tpv">Inicio</Link>
          <div>
            <p className="tpv-kicker">TPV Camarero</p>
            <h1>{waiterMainTab === "tables" ? "Mesas" : "Productos"}</h1>
          </div>
          <div className="tpv-phone-actions">
            <Link className="tpv-phone-admin" href="/tpv/historico">Historial</Link>
            <LogoutButton className="tpv-phone-logout" />
          </div>
        </header>

        {error && <div className="tpv-error">{error}</div>}

        <WaiterMainTabs activeTab={waiterMainTab} onChange={setWaiterMainTab} />

        {waiterMainTab === "tables" && (
          <>
            <div className="tpv-table-toolbar">
              <button className="tpv-button" type="button" onClick={() => setTableModalOpen(true)} disabled={creatingTable}>
                Nueva mesa
              </button>
            </div>

            <section className="tpv-table-search" aria-label="Buscar mesa">
              <Search aria-hidden="true" size={18} strokeWidth={2.2} />
              <input
                inputMode="numeric"
                placeholder="Buscar número de mesa"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </section>

            {!loading && pendingOrdersTotal > 0 && (
              <div className="tpv-mobile-table-warning" role="status">
                <span aria-hidden="true" />
                <strong>Aviso</strong>
                <em>{pendingOrdersLabel}</em>
              </div>
            )}

            <section className="tpv-mobile-table-grid" aria-label="Mesas activas">
              {loading && <div className="tpv-mobile-empty">Cargando mesas...</div>}
              {!loading && filteredTables.length === 0 && (
                <div className="tpv-mobile-empty">No hay mesas activas con ese número.</div>
              )}
              {!loading && filteredTables.map((table) => (
            <button
              className={table.pendingOrders > 0 || table.hasWaiterCall ? "tpv-mobile-table has-pending" : "tpv-mobile-table"}
              type="button"
              key={table.id}
              onClick={() => openWaiterTable(table)}
            >
              <span>Mesa</span>
              <strong>{table.name}</strong>
              {table.pendingOrders > 0 && (
                <em>
                  <i aria-hidden="true" />
                  {table.pendingOrders === 1 ? "1 sin hacer" : `${table.pendingOrders} sin hacer`}
                </em>
              )}
              {table.paymentRequest && (
                <em className="is-payment-request">
                  Quiere pagar con {paymentMethodLabels[table.paymentRequest.paymentMethod] ?? "pago"}
                </em>
              )}
              {table.hasWaiterCall && (
                <em className="is-waiter-call">
                  <i aria-hidden="true" />
                  Llama camarero
                </em>
              )}
            </button>
              ))}
            </section>
          </>
        )}

        {waiterMainTab === "products" && (
          <StockManagementSection
            category={category}
            filteredProducts={filteredProducts}
            onCategoryChange={setCategory}
            onToggleSoldOut={toggleWaiterProductSoldOut}
            productsLoading={productsLoading}
            updatingStockProductId={updatingStockProductId}
            categories={categories}
          />
        )}
        {tableModalOpen && (
          <div className="tpv-modal-backdrop tpv-modal-backdrop-center" role="presentation" onClick={() => !creatingTable && setTableModalOpen(false)}>
            <section
              className="tpv-modal-window tpv-confirm-modal customer-table-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Nueva mesa"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="tpv-modal-head">
                <div>
                  <p className="tpv-kicker">TPV Camarero</p>
                  <h2>Nueva mesa</h2>
                </div>
                <button className="tpv-modal-close" type="button" onClick={() => setTableModalOpen(false)} aria-label="Cerrar" disabled={creatingTable}>
                  <X aria-hidden="true" size={20} strokeWidth={2.2} />
                </button>
              </div>

              <form
                className="tpv-modal-body tpv-table-modal-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  createWaiterTable();
                }}
              >
                <label>
                  <span>Nombre</span>
                  <input
                    value={tableNameDraft}
                    onChange={(event) => setTableNameDraft(event.target.value)}
                    placeholder="Terraza Laura"
                    autoFocus
                    required
                  />
                </label>
              </form>

              <div className="tpv-modal-foot">
                <button className="tpv-button" type="button" onClick={createWaiterTable} disabled={creatingTable || !tableNameDraft.trim()}>
                  {creatingTable ? "Creando..." : "Crear mesa"}
                </button>
              </div>
            </section>
          </div>
        )}
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
          <p className="tpv-kicker">TPV Camarero</p>
          <h1>{selectedTableLabel}</h1>
        </div>
        <div className="tpv-phone-actions">
          <button
            className="customer-waiter-trigger tpv-waiter-ticket-trigger"
            type="button"
            onClick={() => {
              setWaiterTicketOpen(true);
              loadTableOrders();
            }}
          >
            <ReceiptText aria-hidden="true" size={19} strokeWidth={2.4} />
            Ticket
          </button>
          <button
            className="customer-cart-trigger tpv-waiter-cart-trigger"
            type="button"
            onClick={() => setWaiterCartOpen(true)}
            aria-label={`Abrir carrito, ${waiterLineCount} productos`}
          >
            <ShoppingCart aria-hidden="true" size={22} strokeWidth={2.4} />
            {waiterLineCount > 0 && <span>{waiterLineCount}</span>}
          </button>
        </div>
      </header>

      {error && <div className="tpv-error">{error}</div>}

      <div className="tpv-waiter-layout">
        <section className="tpv-waiter-picker" aria-label="Selección de productos">
          <section className="tpv-scroll-tabs" aria-label="Categorías">
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
            {productsLoading && <div className="tpv-mobile-empty">Cargando productos...</div>}
            {!productsLoading && filteredProducts.length === 0 && (
              <div className="tpv-mobile-empty">No hay productos disponibles.</div>
            )}
            {filteredProducts.map((product) => (
              <button
                className={product.soldOut ? "tpv-tile is-sold-out" : "tpv-tile"}
                type="button"
                key={product.id}
                disabled={product.soldOut}
                onClick={() => addWaiterProduct(product)}
              >
                <span>{product.category}</span>
                <strong>{product.name}</strong>
                {product.soldOut && <small className="tpv-tile-stock">Agotado</small>}
                <em>{formatPrice(product.price)}</em>
              </button>
            ))}
          </section>
        </section>

      </div>

      {waiterTicketOpen && (
        <div
          className="tpv-modal-backdrop tpv-modal-backdrop-center"
          role="presentation"
          onClick={() => {
            setWaiterTicketOpen(false);
            cancelEditOrder();
          }}
        >
          <aside
            className="tpv-ticket tpv-waiter-ticket-modal"
            aria-label="Ticket actual"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="tpv-modal-head tpv-waiter-ticket-head">
              <div>
                <p className="tpv-kicker">{selectedTableLabel}</p>
                <h2>Ticket</h2>
              </div>
              <button
                className="tpv-modal-close"
                type="button"
                onClick={() => {
                  setWaiterTicketOpen(false);
                  cancelEditOrder();
                }}
                aria-label="Cerrar ticket"
              >
                <X aria-hidden="true" size={20} strokeWidth={2.2} />
              </button>
            </div>
            <div className="tpv-ticket-head">
              <strong>Ticket mesa {selectedTable}</strong>
              <span>{tableOrders.filter((order) => pendingStatuses.has(order.status)).length} pendientes</span>
            </div>
            {tablePaymentRequest && (
              <div className="tpv-payment-request-alert">
                <div>
                  <strong>Quieren pagar con {paymentMethodLabels[tablePaymentRequest.paymentMethod] ?? "pago"}</strong>
                  <span>Caja confirma si pagan todo o parte.</span>
                </div>
                <em>{formatPrice(tablePaymentRequest.total)}</em>
              </div>
            )}
            <button
              className="tpv-ticket-reset"
              type="button"
              onClick={() => setConfirmModal({
                title: "Reiniciar pedidos",
                message: `Se eliminarán todos los pedidos de la Mesa ${selectedTable}.`,
                confirmLabel: "Reiniciar",
                onConfirm: resetTableOrders,
              })}
              disabled={resettingOrders || (tableOrders.length === 0 && waiterTicket.length === 0)}
            >
              {resettingOrders ? "Reiniciando..." : "Reiniciar pedidos"}
            </button>

            <div className="tpv-segmented" role="tablist" aria-label="Estado de pedidos">
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
                  <p>Pedidos pendientes</p>
                  {ordersLoading && <span className="tpv-ticket-muted">Cargando pedidos...</span>}
                  {!ordersLoading && tableOrders.filter((order) => pendingStatuses.has(order.status)).length === 0 && (
                    <span className="tpv-ticket-muted">Sin pedidos pendientes.</span>
                  )}
                  {!ordersLoading && tableOrders.filter((order) => pendingStatuses.has(order.status)).map((order) => (
                    <TicketReceipt
                      key={order.id}
                      draftQuantities={editingOrderId === order.id ? orderItemDraft : {}}
                      editable={editingOrderId === order.id}
                      order={order}
                      onItemQuantityChange={changeOrderItemDraft}
                      action={(
                        <div className="tpv-ticket-edit-actions">
                          {editingOrderId === order.id ? (
                            <>
                              <button
                                className="tpv-button"
                                type="button"
                                onClick={() => confirmEditOrder(order)}
                                disabled={savingOrderEdit}
                              >
                                {savingOrderEdit ? "Guardando..." : "Confirmar"}
                              </button>
                              <button
                                className="tpv-button tpv-button-secondary"
                                type="button"
                                onClick={cancelEditOrder}
                                disabled={savingOrderEdit}
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <button
                              className="tpv-button tpv-button-secondary"
                              type="button"
                              onClick={() => startEditOrder(order)}
                              disabled={Boolean(editingOrderId)}
                            >
                              Editar
                            </button>
                          )}
                        </div>
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
                    <span className="tpv-ticket-muted">Todavía no hay entregados.</span>
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
                    <span className="tpv-ticket-muted">Todavía no hay tickets pagados.</span>
                  )}
                  {!ordersLoading && paidTicket.items.length > 0 && (
                    <TicketReceipt key="paid-ticket" order={paidTicket} />
                  )}
                </>
              )}
            </div>
          </aside>
        </div>
      )}

      {waiterCartOpen && (
        <div className="tpv-modal-backdrop tpv-modal-backdrop-center" role="presentation" onClick={() => setWaiterCartOpen(false)}>
          <section
            className="tpv-modal-window tpv-confirm-modal customer-cart-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Carrito camarero"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="tpv-modal-head">
              <div>
                <p className="tpv-kicker">{selectedTableLabel}</p>
                <h2>Pedido camarero</h2>
              </div>
              <button className="tpv-modal-close" type="button" onClick={() => setWaiterCartOpen(false)} aria-label="Cerrar carrito">
                <X aria-hidden="true" size={20} strokeWidth={2.2} />
              </button>
            </div>

            <WaiterCartContent
              cart={waiterTicket}
              lineCount={waiterLineCount}
              onAdd={addWaiterProduct}
              onRemove={removeWaiterProduct}
              onSend={sendWaiterTicket}
              sending={sendingWaiterTicket}
              total={waiterTotal}
            />
          </section>
        </div>
      )}

      {cubataDraft && (
        <div className="tpv-modal-backdrop" role="presentation" onClick={() => setCubataDraft(null)}>
          <section
            className="tpv-modal-window tpv-modal-window-compact"
            role="dialog"
            aria-modal="true"
            aria-label="Seleccionar cubata"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="tpv-modal-head">
              <div>
                <p className="tpv-kicker">Cubata - {formatPrice(cubataDraft.product.price)}</p>
                <h2>{cubataStep === "alcohol" ? "Elige alcohol" : cubataStep === "refresco" ? "Elige refresco" : "Completa cubata"}</h2>
              </div>
              <button className="tpv-modal-close" type="button" onClick={() => setCubataDraft(null)} aria-label="Cerrar">
                <X aria-hidden="true" size={20} strokeWidth={2.2} />
              </button>
            </div>

            <div className="tpv-modal-body tpv-mixer-modal tpv-mixer-step-modal">
              <MixerSteps step={cubataStep} />
              {cubataStep === "alcohol" && (
                <MixerColumn
                  label="1. Alcohol"
                  products={alcoholProducts}
                  selectedId={cubataDraft.alcoholProductId}
                  onSelect={selectCubataAlcohol}
                />
              )}
              {cubataStep === "refresco" && (
                <MixerColumn
                  label="2. Refresco"
                  products={cubataRefrescoProducts}
                  selectedId={cubataDraft.refrescoProductId}
                  onSelect={selectCubataRefresco}
                />
              )}
              {cubataStep === "confirm" && (
                <div className="tpv-mixer-summary">
                  <MixerChoiceSummary label="Alcohol" product={selectedCubataAlcohol} />
                  <MixerChoiceSummary label="Refresco" product={selectedCubataRefresco} />
                </div>
              )}
            </div>

            <div className="tpv-modal-foot">
              {cubataStep !== "confirm" && (
                <button className="tpv-button tpv-button-secondary" type="button" onClick={() => setCubataDraft(null)}>
                  Cancelar
                </button>
              )}
              {cubataStep === "refresco" && (
                <button className="tpv-button tpv-button-secondary" type="button" onClick={() => moveCubataStep("alcohol")}>
                  Atrás
                </button>
              )}
              {cubataStep === "confirm" && (
                <>
                  <button className="tpv-button tpv-button-secondary" type="button" onClick={() => moveCubataStep("refresco")}>
                    Atrás
                  </button>
                  <button
                    className="tpv-button"
                    type="button"
                    onClick={confirmCubata}
                    disabled={!cubataDraft.alcoholProductId || !cubataDraft.refrescoProductId}
                  >
                    Completar cubata
                  </button>
                </>
              )}
            </div>
          </section>
        </div>
      )}

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
                      emptyLabel="No quedan líneas por mover."
                    />
                  </div>

                  <div className="tpv-payment-ticket-column">
                    <p>Ticket separado</p>
                    <SplitSelectableReceipt
                      order={deliveredTicket}
                      selectedItems={separateSelection}
                      mode="target"
                      onLineClick={removeSeparateItem}
                      emptyLabel="Aún no has separado nada."
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
      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel}
          onCancel={() => setConfirmModal(null)}
          onConfirm={() => {
            const action = confirmModal.onConfirm;
            setConfirmModal(null);
            action();
          }}
        />
      )}
      {tableModalOpen && (
        <div className="tpv-modal-backdrop tpv-modal-backdrop-center" role="presentation" onClick={() => !creatingTable && setTableModalOpen(false)}>
          <section
            className="tpv-modal-window tpv-confirm-modal customer-table-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Nueva mesa"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="tpv-modal-head">
              <div>
                <p className="tpv-kicker">TPV Camarero</p>
                <h2>Nueva mesa</h2>
              </div>
              <button className="tpv-modal-close" type="button" onClick={() => setTableModalOpen(false)} aria-label="Cerrar" disabled={creatingTable}>
                <X aria-hidden="true" size={20} strokeWidth={2.2} />
              </button>
            </div>

            <form
              className="tpv-modal-body tpv-table-modal-form"
              onSubmit={(event) => {
                event.preventDefault();
                createWaiterTable();
              }}
            >
              <label>
                <span>Nombre</span>
                <input
                  value={tableNameDraft}
                  onChange={(event) => setTableNameDraft(event.target.value)}
                  placeholder="Terraza Laura"
                  autoFocus
                  required
                />
              </label>
            </form>

            <div className="tpv-modal-foot">
              <button className="tpv-button" type="button" onClick={createWaiterTable} disabled={creatingTable || !tableNameDraft.trim()}>
                {creatingTable ? "Creando..." : "Crear mesa"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function MixerSteps({ step }) {
  const steps = [
    ["alcohol", "Alcohol"],
    ["refresco", "Refresco"],
    ["confirm", "Completar"],
  ];
  const currentIndex = steps.findIndex(([id]) => id === step);

  return (
    <div className="tpv-mixer-steps" aria-label="Pasos del cubata">
      {steps.map(([id, label], index) => (
        <span
          className={[
            "tpv-mixer-step",
            step === id ? "is-active" : "",
            index < currentIndex ? "is-done" : "",
          ].filter(Boolean).join(" ")}
          key={id}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function MixerChoiceSummary({ label, product }) {
  return (
    <div className="tpv-mixer-choice">
      <span>{label}</span>
      <strong>{product?.name ?? "Sin seleccionar"}</strong>
    </div>
  );
}

function WaiterCartContent({
  cart,
  lineCount,
  onAdd,
  onRemove,
  onSend,
  sending,
  total,
}) {
  return (
    <>
      <div className="tpv-modal-body customer-cart">
        <div className="customer-cart-head">
          <strong>
            <ShoppingCart aria-hidden="true" size={18} strokeWidth={2.4} />
            Carrito
          </strong>
          <span>{lineCount} productos</span>
        </div>

        <div className="customer-cart-lines">
          {cart.length === 0 && <p>Toca productos para añadirlos.</p>}
          {cart.map((item) => (
            <div className="customer-cart-line" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <span>{formatPrice(item.price)}</span>
              </div>
              <div className="tpv-qty">
                <button type="button" onClick={() => onRemove(item.id)} aria-label={`Quitar ${item.name}`}>
                  <Minus aria-hidden="true" size={16} strokeWidth={2.4} />
                </button>
                <span>{item.qty}</span>
                <button type="button" onClick={() => onAdd(item)} aria-label={`Añadir ${item.name}`}>
                  <Plus aria-hidden="true" size={16} strokeWidth={2.4} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="customer-cart-total">
          <span>Total</span>
          <strong>{formatPrice(total)}</strong>
        </div>
      </div>

      <div className="tpv-modal-foot">
        <button className="tpv-button customer-confirm-button" type="button" onClick={onSend} disabled={cart.length === 0 || sending}>
          <ShoppingCart aria-hidden="true" size={18} strokeWidth={2.4} />
          {sending ? "Añadiendo pedido..." : "Añadir a pendientes"}
        </button>
      </div>
    </>
  );
}

function MixerColumn({ label, products, selectedId, onSelect }) {
  return (
    <div className="tpv-mixer-column">
      <p>{label}</p>
      <div className="tpv-mixer-options">
        {products.length === 0 && <span className="tpv-ticket-muted">No hay productos de este tipo.</span>}
        {products.map((product) => (
          <button
            className={[
              selectedId === product.id ? "is-active" : "",
              product.soldOut ? "is-sold-out" : "",
            ].filter(Boolean).join(" ")}
            type="button"
            key={product.id}
            disabled={product.soldOut}
            onClick={() => onSelect(product.id)}
          >
            <strong>{product.name}</strong>
            {product.soldOut && <small>Agotado</small>}
          </button>
        ))}
      </div>
    </div>
  );
}
