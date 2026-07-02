"use client";

import { Banknote, BellRing, Check, CreditCard, Minus, Plus, ReceiptText, ShoppingCart, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { pruneCartByVisibleProducts, subscribeToCatalogChanges } from "./catalogRealtime";
import { formatPrice } from "./data";

const TABLE_STORAGE_KEY = "lalianta_customer_table";
const TABLE_STORAGE_TTL = 12 * 60 * 60 * 1000;
const openAccountStatuses = new Set(["pending", "preparing", "delivered"]);

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

export default function CustomerOrder({ tableNumber = "" }) {
  const [selectedTableNumber, setSelectedTableNumber] = useState(String(tableNumber || ""));
  const [tableDraft, setTableDraft] = useState(String(tableNumber || ""));
  const [tableModalOpen, setTableModalOpen] = useState(true);
  const [tableList, setTableList] = useState([]);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [qrPopup, setQrPopup] = useState(null);
  const [qrPopupOpen, setQrPopupOpen] = useState(false);
  const [category, setCategory] = useState("Todo");
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [tableOrders, setTableOrders] = useState([]);
  const [accountLoading, setAccountLoading] = useState(false);
  const [callingWaiter, setCallingWaiter] = useState(false);
  const [requestingPayment, setRequestingPayment] = useState("");
  const [paymentNotice, setPaymentNotice] = useState("");
  const [waiterNotice, setWaiterNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [sentCode, setSentCode] = useState("");
  const [error, setError] = useState("");
  const [productList, setProductList] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [customerOrderingEnabled, setCustomerOrderingEnabled] = useState(null);
  const [blockedReason, setBlockedReason] = useState("");
  const [cubataDraft, setCubataDraft] = useState(null);
  const [cubataConfigs, setCubataConfigs] = useState([]);

  async function loadProductCatalog({ showLoading = false } = {}) {
    if (showLoading) setProductsLoading(true);

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
      setCart((current) => pruneCartByVisibleProducts(current, productsData.products));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      if (showLoading) setProductsLoading(false);
    }
  }

  useEffect(() => {
    const qrTableNumber = String(tableNumber || "");
    const storedTableNumber = readStoredTableNumber();
    const initialTableNumber = qrTableNumber || storedTableNumber;

    setSelectedTableNumber(initialTableNumber);
    setTableDraft(initialTableNumber);
    setTableModalOpen(!storedTableNumber || Boolean(qrTableNumber && qrTableNumber !== storedTableNumber));
  }, [tableNumber]);

  useEffect(() => {
    async function loadTables() {
      setTablesLoading(true);

      try {
        const response = await fetch("/api/tables?includeInactive=false", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudieron cargar las mesas");
        setTableList(data.tables);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setTablesLoading(false);
      }
    }

    loadTables();
  }, []);

  useEffect(() => {
    async function loadCustomerOrderingState() {
      try {
        const response = await fetch("/api/settings/customer-ordering", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudo comprobar si los pedidos están permitidos");
        setCustomerOrderingEnabled(Boolean(data.enabled));
        setBlockedReason(data.blockedReason || "");
        if (!data.enabled) setCart([]);
      } catch (requestError) {
        setError(requestError.message);
        setCustomerOrderingEnabled(false);
        setBlockedReason("qr_blocked");
      }
    }

    loadCustomerOrderingState();
  }, []);

  useEffect(() => {
    async function loadQrPopup() {
      try {
        const response = await fetch("/api/settings/qr-popup", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudo cargar el popup QR");
        setQrPopup(data.popup);
      } catch {
        setQrPopup(null);
      }
    }

    loadQrPopup();
  }, []);

  useEffect(() => {
    loadProductCatalog({ showLoading: true });
  }, []);

  useEffect(() => (
    subscribeToCatalogChanges(() => {
      loadProductCatalog();
    })
  ), []);

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

  const total = cart.reduce((sum, item) => sum + item.qty * item.price, 0);
  const lineCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const openTableOrders = useMemo(
    () => tableOrders.filter((order) => openAccountStatuses.has(order.status)),
    [tableOrders],
  );
  const accountTotal = openTableOrders.reduce((sum, order) => sum + Number(order.total ?? 0), 0);

  useEffect(() => {
    if (!selectedTableNumber || tableModalOpen) return;
    loadTableAccount(selectedTableNumber);
  }, [selectedTableNumber, tableModalOpen]);

  async function loadTableAccount(tableNumberToLoad = selectedTableNumber) {
    if (!tableNumberToLoad) return;
    setAccountLoading(true);

    try {
      const response = await fetch(`/api/orders?tableNumber=${tableNumberToLoad}&includeItems=true`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo cargar la cuenta de la mesa");
      setTableOrders(data.orders);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setAccountLoading(false);
    }
  }

  function changeTable(nextTableNumber) {
    setSelectedTableNumber(nextTableNumber);
    setCart([]);
    setTableOrders([]);
    setSentCode("");
    setCubataDraft(null);

    if (typeof window !== "undefined") {
      const nextUrl = nextTableNumber ? `/pedido?mesa=${nextTableNumber}` : "/pedido";
      window.history.replaceState(null, "", nextUrl);
    }
  }

  function confirmTableSelection() {
    const nextTableNumber = String(tableDraft || "").trim();
    if (!nextTableNumber) {
      setError("Selecciona una mesa para poder pedir.");
      return;
    }

    changeTable(nextTableNumber);
    storeTableNumber(nextTableNumber);
    setTableModalOpen(false);
    if (qrPopup?.enabled) setQrPopupOpen(true);
    setError("");
  }

  function openCart() {
    setCartOpen(true);
    loadTableAccount(selectedTableNumber);
  }

  function openTicket() {
    setTicketOpen(true);
    loadTableAccount(selectedTableNumber);
  }

  function addCartItem(product) {
    if (product.soldOut) return;

    setSentCode("");
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }

      return [...current, { ...product, qty: 1 }];
    });
  }

  function addProduct(product) {
    if (!customerOrderingEnabled || product.soldOut) return;

    if (isCubataProduct(product) && !product.alcoholProductId && !product.refrescoProductId) {
      setCubataDraft({
        alcoholProductId: "",
        product,
        refrescoProductId: "",
        step: "alcohol",
      });
      return;
    }

    addCartItem(product);
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

    addCartItem(buildCubataItem(cubataDraft.product, alcoholProduct, refrescoProduct));
    setCubataDraft(null);
  }

  function removeProduct(productId) {
    setCart((current) => current.flatMap((item) => {
      if (item.id !== productId) return [item];
      if (item.qty <= 1) return [];
      return [{ ...item, qty: item.qty - 1 }];
    }));
  }

  async function sendOrder() {
    if (!customerOrderingEnabled) {
      setError(
        blockedReason === "cash_closed"
          ? "Caja cerrada. Actualmente no está permitido realizar pedidos desde esta mesa."
          : "Actualmente no está permitido realizar pedidos desde esta mesa.",
      );
      return;
    }

    setSending(true);
    setError("");

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableNumber: selectedTableNumber,
          source: "customer",
          items: cart.map((item) => ({
            alcoholProductId: item.alcoholProductId,
            productId: item.productId ?? item.id,
            quantity: item.qty,
            refrescoProductId: item.refrescoProductId,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo enviar el pedido");

      setCart([]);
      setCartOpen(false);
      setSentCode(data.order.orderCode);
      await loadTableAccount(selectedTableNumber);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSending(false);
    }
  }

  async function requestPayment(paymentMethod) {
    if (!selectedTableNumber || accountTotal <= 0 || requestingPayment) return;

    setRequestingPayment(paymentMethod);
    setError("");

    try {
      const response = await fetch("/api/payment-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod,
          scope: "all",
          tableNumber: selectedTableNumber,
          totalCents: Math.round(accountTotal * 100),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo avisar a caja");

      const methodLabel = paymentMethod === "card" ? "tarjeta" : "efectivo";
      setPaymentNotice(`Hemos avisado a caja: queréis pagar con ${methodLabel}.`);
      window.setTimeout(() => setPaymentNotice(""), 2600);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRequestingPayment("");
    }
  }

  async function callWaiter() {
    if (!selectedTableNumber || callingWaiter) return;

    setCallingWaiter(true);
    setError("");

    try {
      const response = await fetch("/api/waiter-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableNumber: selectedTableNumber }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo llamar al camarero");

      setWaiterNotice("Hemos avisado al camarero.");
      window.setTimeout(() => setWaiterNotice(""), 2400);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCallingWaiter(false);
    }
  }

  return (
    <main className="customer-order">
      <header className="customer-head">
        <div>
          <p className="tpv-kicker">La Lianta</p>
          <h1>Mesa {selectedTableNumber || "-"}</h1>
        </div>
        <div className="customer-head-actions">
          <button
            className="customer-waiter-trigger"
            type="button"
            onClick={openTicket}
            disabled={!selectedTableNumber}
          >
            <ReceiptText aria-hidden="true" size={19} strokeWidth={2.4} />
            Ticket
          </button>
          <button
            className="customer-waiter-trigger"
            type="button"
            onClick={callWaiter}
            disabled={!selectedTableNumber || callingWaiter}
          >
            <BellRing aria-hidden="true" size={19} strokeWidth={2.4} />
            {callingWaiter ? "Avisando" : "Camarero"}
          </button>
          <button
            className="customer-cart-trigger"
            type="button"
            onClick={openCart}
            aria-label={`Abrir carrito, ${lineCount} productos`}
          >
            <ShoppingCart aria-hidden="true" size={22} strokeWidth={2.4} />
            {lineCount > 0 && <span>{lineCount}</span>}
          </button>
        </div>
      </header>

      {sentCode && (
        <div className="customer-confirm-overlay" role="alertdialog" aria-live="assertive">
          <div className="customer-confirm-card">
            <span className="customer-confirm-icon">
              <Check aria-hidden="true" size={32} strokeWidth={3} />
            </span>
            <h2>Pedido enviado</h2>
            <p>Tu pedido ya está en la barra y se está preparando.</p>
            <span className="customer-confirm-code">Código {sentCode}</span>
            <button className="tpv-button" type="button" onClick={() => setSentCode("")}>
              Seguir pidiendo
            </button>
          </div>
        </div>
      )}

      {error && <div className="tpv-error">{error}</div>}
      {paymentNotice && <div className="tpv-toast" role="status">{paymentNotice}</div>}
      {waiterNotice && <div className="tpv-toast" role="status">{waiterNotice}</div>}

      {customerOrderingEnabled === null && (
        <section className="customer-blocked" aria-live="polite">
          <strong>Comprobando disponibilidad</strong>
          <p>Estamos revisando si los pedidos desde mesa están activos.</p>
        </section>
      )}

      {customerOrderingEnabled === false && (
        <section className="customer-blocked" aria-live="polite">
          <strong>{blockedReason === "cash_closed" ? "Caja cerrada" : "Pedidos desde mesa no disponibles"}</strong>
          <p>
            {blockedReason === "cash_closed"
              ? "La caja está cerrada y ahora mismo no se pueden realizar pedidos desde esta mesa."
              : "Actualmente no está permitido realizar pedidos desde esta mesa."}
          </p>
          <span>Por favor, avisa al personal para realizar tu pedido.</span>
        </section>
      )}

      {customerOrderingEnabled && (
        <>
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

          <section className="customer-products" aria-label="Productos">
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
                onClick={() => addProduct(product)}
              >
                <span>{product.category}</span>
                <strong>{product.name}</strong>
                {product.soldOut && <small className="tpv-tile-stock">Agotado</small>}
                <em>{formatPrice(product.price)}</em>
              </button>
            ))}
          </section>
        </>
      )}

      {tableModalOpen && (
        <div className="tpv-modal-backdrop tpv-modal-backdrop-center" role="presentation">
          <section
            className="tpv-modal-window tpv-confirm-modal customer-table-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Seleccionar mesa"
          >
            <div className="tpv-modal-head">
              <div>
                <p className="tpv-kicker">La Lianta</p>
                <h2>Selecciona tu mesa</h2>
              </div>
            </div>

            <div className="tpv-modal-body customer-table-picker">
              <label>
                <span>Mesa</span>
                <select
                  value={tableDraft}
                  onChange={(event) => setTableDraft(event.target.value)}
                  disabled={tablesLoading}
                >
                  {!tableDraft && <option value="">Selecciona mesa</option>}
                  {tableDraft && !tableList.some((table) => String(table.number) === tableDraft) && (
                    <option value={tableDraft}>Mesa {tableDraft}</option>
                  )}
                  {tableList.map((table) => (
                    <option key={table.id} value={table.number}>Mesa {table.number}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="tpv-modal-foot">
              <button className="tpv-button" type="button" onClick={confirmTableSelection} disabled={!tableDraft || tablesLoading}>
                Confirmar
              </button>
            </div>
          </section>
        </div>
      )}

      {cartOpen && (
        <div className="tpv-modal-backdrop tpv-modal-backdrop-center" role="presentation" onClick={() => setCartOpen(false)}>
          <section
            className="tpv-modal-window tpv-confirm-modal customer-cart-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Carrito"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="tpv-modal-head">
              <div>
                <p className="tpv-kicker">Mesa {selectedTableNumber || "-"}</p>
                <h2>Tu pedido</h2>
              </div>
              <button className="tpv-modal-close" type="button" onClick={() => setCartOpen(false)} aria-label="Cerrar carrito">
                <X aria-hidden="true" size={20} strokeWidth={2.2} />
              </button>
            </div>

            <CartContent
              cart={cart}
              lineCount={lineCount}
              total={total}
              sending={sending}
              selectedTableNumber={selectedTableNumber}
              onAdd={addProduct}
              onRemove={removeProduct}
              onSend={sendOrder}
            />
          </section>
        </div>
      )}

      {ticketOpen && (
        <div className="tpv-modal-backdrop tpv-modal-backdrop-center" role="presentation" onClick={() => setTicketOpen(false)}>
          <section
            className="tpv-modal-window tpv-confirm-modal customer-cart-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Ticket de mesa"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="tpv-modal-head">
              <div>
                <p className="tpv-kicker">Mesa {selectedTableNumber || "-"}</p>
                <h2>Ticket</h2>
              </div>
              <button className="tpv-modal-close" type="button" onClick={() => setTicketOpen(false)} aria-label="Cerrar ticket">
                <X aria-hidden="true" size={20} strokeWidth={2.2} />
              </button>
            </div>

            <CustomerTicketContent
              accountLoading={accountLoading}
              accountTotal={accountTotal}
              onRequestPayment={requestPayment}
              orders={openTableOrders}
              requestingPayment={requestingPayment}
              selectedTableNumber={selectedTableNumber}
            />
          </section>
        </div>
      )}

      {qrPopupOpen && qrPopup?.enabled && (
        <div className="tpv-modal-backdrop tpv-modal-backdrop-center" role="presentation" onClick={() => setQrPopupOpen(false)}>
          <section
            className="tpv-modal-window tpv-confirm-modal customer-qr-popup-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Aviso"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="tpv-modal-close customer-qr-popup-close" type="button" onClick={() => setQrPopupOpen(false)} aria-label="Cerrar aviso">
              <X aria-hidden="true" size={20} strokeWidth={2.2} />
            </button>
            <img src={qrPopup.imageUrl} alt="Aviso de La Lianta" />
          </section>
        </div>
      )}

      {cubataDraft && (
        <div className="tpv-modal-backdrop tpv-modal-backdrop-center" role="presentation" onClick={() => setCubataDraft(null)}>
          <section
            className="tpv-modal-window tpv-modal-window-compact customer-cubata-modal"
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
    </main>
  );
}

function readStoredTableNumber() {
  if (typeof window === "undefined") return "";

  try {
    const rawValue = window.localStorage.getItem(TABLE_STORAGE_KEY);
    if (!rawValue) return "";
    const saved = JSON.parse(rawValue);
    if (!saved?.tableNumber || Date.now() > Number(saved.expiresAt ?? 0)) {
      window.localStorage.removeItem(TABLE_STORAGE_KEY);
      return "";
    }

    return String(saved.tableNumber);
  } catch {
    window.localStorage.removeItem(TABLE_STORAGE_KEY);
    return "";
  }
}

function storeTableNumber(tableNumber) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(TABLE_STORAGE_KEY, JSON.stringify({
    expiresAt: Date.now() + TABLE_STORAGE_TTL,
    tableNumber,
  }));
}

function CustomerTicketContent({
  accountLoading,
  accountTotal,
  onRequestPayment,
  orders,
  requestingPayment,
  selectedTableNumber,
}) {
  const ticketLines = orders.flatMap((order) => (
    (order.items ?? []).map((item) => ({
      id: `${order.id}-${item.id ?? item.productName}`,
      name: item.productName,
      quantity: item.quantity,
      status: order.status,
      total: item.quantity * item.unitPrice,
      unitPrice: item.unitPrice,
    }))
  ));
  const statusLabels = {
    delivered: "Entregado",
    pending: "Pendiente",
    preparing: "Preparando",
  };
  const canRequestPayment = Boolean(selectedTableNumber) && accountTotal > 0 && !requestingPayment;

  return (
    <div className="tpv-modal-body customer-cart customer-ticket-view">
      <div className="customer-account-total">
        <span>{accountLoading ? "Actualizando ticket" : "Total cuenta"}</span>
        <strong>{formatPrice(accountTotal)}</strong>
      </div>

      <div className="customer-payment-request" aria-label="Avisar a caja para pagar">
        <p>Si vais a pagar solo parte, caja lo gestionará al llegar.</p>
        <div>
          <button type="button" onClick={() => onRequestPayment("cash")} disabled={!canRequestPayment}>
            <Banknote aria-hidden="true" size={17} strokeWidth={2.3} />
            {requestingPayment === "cash" ? "Avisando..." : "Pagar efectivo"}
          </button>
          <button type="button" onClick={() => onRequestPayment("card")} disabled={!canRequestPayment}>
            <CreditCard aria-hidden="true" size={17} strokeWidth={2.3} />
            {requestingPayment === "card" ? "Avisando..." : "Pagar tarjeta"}
          </button>
        </div>
      </div>

      <div className="customer-cart-head">
        <strong>
          <ReceiptText aria-hidden="true" size={18} strokeWidth={2.4} />
          Pedido enviado
        </strong>
        <span>{ticketLines.length} líneas</span>
      </div>

      <div className="customer-cart-lines">
        {!accountLoading && ticketLines.length === 0 && <p>Todavía no hay pedidos en esta mesa.</p>}
        {accountLoading && <p>Actualizando ticket...</p>}
        {!accountLoading && ticketLines.map((item) => (
          <div className="customer-cart-line customer-ticket-line" key={item.id}>
            <div>
              <strong>{item.name}</strong>
              <span>{item.quantity} x {formatPrice(item.unitPrice)}</span>
            </div>
            <div>
              <em>{statusLabels[item.status] ?? item.status}</em>
              <strong>{formatPrice(item.total)}</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CartContent({
  cart,
  lineCount,
  onAdd,
  onRemove,
  onSend,
  selectedTableNumber,
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
        <button className="tpv-button customer-confirm-button" type="button" onClick={onSend} disabled={cart.length === 0 || sending || !selectedTableNumber}>
          <ShoppingCart aria-hidden="true" size={18} strokeWidth={2.4} />
          {sending ? "Enviando pedido..." : "Confirmar pedido"}
        </button>
      </div>
    </>
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
