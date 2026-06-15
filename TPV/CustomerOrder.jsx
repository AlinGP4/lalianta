"use client";

import { Check, Minus, Plus, ShoppingCart, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatPrice } from "./data";

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
  const [category, setCategory] = useState("Todo");
  const [cart, setCart] = useState([]);
  const [sending, setSending] = useState(false);
  const [sentCode, setSentCode] = useState("");
  const [error, setError] = useState("");
  const [productList, setProductList] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [customerOrderingEnabled, setCustomerOrderingEnabled] = useState(null);
  const [blockedReason, setBlockedReason] = useState("");
  const [cubataDraft, setCubataDraft] = useState(null);

  useEffect(() => {
    async function loadCustomerOrderingState() {
      try {
        const response = await fetch("/api/settings/customer-ordering", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudo comprobar si los pedidos estan permitidos");
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
    async function loadProducts() {
      setProductsLoading(true);

      try {
        const response = await fetch("/api/products?includeInactive=false", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudieron cargar los productos");
        setProductList(data.products);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setProductsLoading(false);
      }
    }

    loadProducts();
  }, []);

  const categories = useMemo(() => (
    ["Todo", ...Array.from(new Set(productList.map((product) => product.category))).sort()]
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
  const selectedCubataAlcohol = useMemo(
    () => alcoholProducts.find((product) => product.id === cubataDraft?.alcoholProductId),
    [alcoholProducts, cubataDraft?.alcoholProductId],
  );
  const selectedCubataRefresco = useMemo(
    () => refrescoProducts.find((product) => product.id === cubataDraft?.refrescoProductId),
    [refrescoProducts, cubataDraft?.refrescoProductId],
  );
  const cubataStep = cubataDraft?.step ?? "alcohol";

  const total = cart.reduce((sum, item) => sum + item.qty * item.price, 0);

  function addCartItem(product) {
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
    if (!customerOrderingEnabled) return;

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
    const refrescoProduct = refrescoProducts.find((product) => product.id === cubataDraft.refrescoProductId);
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
          ? "Caja cerrada. Actualmente no esta permitido realizar pedidos desde esta mesa."
          : "Actualmente no esta permitido realizar pedidos desde esta mesa.",
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
          tableNumber,
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
      setSentCode(data.order.orderCode);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="customer-order">
      <header className="customer-head">
        <div>
          <p className="tpv-kicker">La Lianta</p>
          <h1>Mesa {tableNumber || "-"}</h1>
        </div>
        <span>Pedido cliente</span>
      </header>

      {sentCode && (
        <div className="customer-confirm-overlay" role="alertdialog" aria-live="assertive">
          <div className="customer-confirm-card">
            <span className="customer-confirm-icon">
              <Check aria-hidden="true" size={32} strokeWidth={3} />
            </span>
            <h2>Pedido enviado</h2>
            <p>Tu pedido ya esta en la barra y se esta preparando.</p>
            <span className="customer-confirm-code">Codigo {sentCode}</span>
            <button className="tpv-button" type="button" onClick={() => setSentCode("")}>
              Seguir pidiendo
            </button>
          </div>
        </div>
      )}

      {error && <div className="tpv-error">{error}</div>}

      {customerOrderingEnabled === null && (
        <section className="customer-blocked" aria-live="polite">
          <strong>Comprobando disponibilidad</strong>
          <p>Estamos revisando si los pedidos desde mesa estan activos.</p>
        </section>
      )}

      {customerOrderingEnabled === false && (
        <section className="customer-blocked" aria-live="polite">
          <strong>{blockedReason === "cash_closed" ? "Caja cerrada" : "Pedidos desde mesa no disponibles"}</strong>
          <p>
            {blockedReason === "cash_closed"
              ? "La caja esta cerrada y ahora mismo no se pueden realizar pedidos desde esta mesa."
              : "Actualmente no esta permitido realizar pedidos desde esta mesa."}
          </p>
          <span>Por favor, avisa al personal para realizar tu pedido.</span>
        </section>
      )}

      {customerOrderingEnabled && (
        <>
      <section className="tpv-scroll-tabs" aria-label="Categorias">
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
          <button className="tpv-tile" type="button" key={product.id} onClick={() => addProduct(product)}>
            <span>{product.category}</span>
            <strong>{product.name}</strong>
            <em>{formatPrice(product.price)}</em>
          </button>
        ))}
      </section>

      <section className="customer-cart" aria-label="Carrito">
        <div className="customer-cart-head">
          <strong>
            <ShoppingCart aria-hidden="true" size={18} strokeWidth={2.4} />
            Tu pedido
          </strong>
          <span>{cart.length} productos</span>
        </div>

        <div className="customer-cart-lines">
          {cart.length === 0 && <p>Toca productos para anadirlos.</p>}
          {cart.map((item) => (
            <div className="customer-cart-line" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <span>{formatPrice(item.price)}</span>
              </div>
              <div className="tpv-qty">
                <button type="button" onClick={() => removeProduct(item.id)} aria-label={`Quitar ${item.name}`}>
                  <Minus aria-hidden="true" size={16} strokeWidth={2.4} />
                </button>
                <span>{item.qty}</span>
                <button type="button" onClick={() => addProduct(item)} aria-label={`Anadir ${item.name}`}>
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
        <button className="tpv-button customer-confirm-button" type="button" onClick={sendOrder} disabled={cart.length === 0 || sending || !tableNumber}>
          <ShoppingCart aria-hidden="true" size={18} strokeWidth={2.4} />
          {sending ? "Enviando pedido..." : "Confirmar pedido"}
        </button>
      </section>
        </>
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
                <p className="tpv-kicker">Cubata · {formatPrice(cubataDraft.product.price)}</p>
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
                  products={refrescoProducts}
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
              <button className="tpv-button tpv-button-secondary" type="button" onClick={() => setCubataDraft(null)}>
                Cancelar
              </button>
              {cubataStep === "refresco" && (
                <button className="tpv-button tpv-button-secondary" type="button" onClick={() => moveCubataStep("alcohol")}>
                  Atras
                </button>
              )}
              {cubataStep === "confirm" && (
                <>
                  <button className="tpv-button tpv-button-secondary" type="button" onClick={() => moveCubataStep("refresco")}>
                    Atras
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
            className={selectedId === product.id ? "is-active" : ""}
            type="button"
            key={product.id}
            onClick={() => onSelect(product.id)}
          >
            <strong>{product.name}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}
