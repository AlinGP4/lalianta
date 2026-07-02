"use client";

import { Minus, Plus, ReceiptText, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { pruneCartByVisibleProducts, subscribeToCatalogChanges } from "./catalogRealtime";
import { formatPrice } from "./data";
import LogoutButton from "./LogoutButton";

export default function BarSalesPage() {
  const [category, setCategory] = useState("Todo");
  const [cart, setCart] = useState([]);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [cashOpen, setCashOpen] = useState(null);
  const [selling, setSelling] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [error, setError] = useState("");

  async function loadProducts({ showLoading = false } = {}) {
    if (showLoading) setProductsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/products?includeInactive=false", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudieron cargar los productos");
      setProducts(data.products);
      setCart((current) => pruneCartByVisibleProducts(current, data.products));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      if (showLoading) setProductsLoading(false);
    }
  }

  useEffect(() => {
    async function loadCashState() {
      try {
        const response = await fetch("/api/settings/cash-register", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudo comprobar la caja");
        setCashOpen(Boolean(data.cashOpen));
      } catch (requestError) {
        setError(requestError.message);
        setCashOpen(false);
      }
    }

    loadProducts({ showLoading: true });
    loadCashState();
  }, []);

  useEffect(() => (
    subscribeToCatalogChanges(() => {
      loadProducts();
    })
  ), []);

  const categories = useMemo(() => (
    ["Todo", ...Array.from(new Set(products.map((product) => product.category).filter(Boolean)))]
  ), [products]);

  const filteredProducts = useMemo(() => {
    if (category === "Todo") return products;
    return products.filter((product) => product.category === category);
  }, [category, products]);

  const total = cart.reduce((sum, item) => sum + item.qty * item.price, 0);
  const lineCount = cart.reduce((sum, item) => sum + item.qty, 0);

  function addProduct(product) {
    if (!cashOpen || product.soldOut) return;
    setLastSale(null);
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }

      return [...current, { ...product, qty: 1 }];
    });
  }

  function removeProduct(productId) {
    setCart((current) => current.flatMap((item) => {
      if (item.id !== productId) return [item];
      if (item.qty <= 1) return [];
      return [{ ...item, qty: item.qty - 1 }];
    }));
  }

  async function sellCart() {
    if (cart.length === 0 || !cashOpen) return;

    setSelling(true);
    setError("");

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "bar",
          items: cart.map((item) => ({
            productId: item.id,
            quantity: item.qty,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo registrar la venta");

      setLastSale(data.order);
      setCart([]);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSelling(false);
    }
  }

  return (
    <main className="tpv-phone tpv-waiter-order tpv-bar-sale">
      <header className="tpv-phone-head">
        <Link className="tpv-phone-home" href="/tpv">Inicio</Link>
        <div>
          <p className="tpv-kicker">TPV Barra</p>
          <h1>Venta en barra</h1>
        </div>
        <div className="tpv-phone-actions">
          <Link className="tpv-phone-admin" href="/tpv/admin/productos">Admin</Link>
          <LogoutButton className="tpv-phone-logout" />
        </div>
      </header>

      {error && <div className="tpv-error">{error}</div>}

      {cashOpen === false && (
        <section className="customer-blocked" aria-live="polite">
          <strong>Caja cerrada</strong>
          <p>Abre caja para poder registrar ventas en barra.</p>
        </section>
      )}

      {lastSale && (
        <div className="customer-success">
          <ReceiptText aria-hidden="true" size={18} strokeWidth={2.4} />
          Venta registrada: {lastSale.orderCode}
        </div>
      )}

      <section className="tpv-bar-summary" aria-label="Resumen de venta">
        <div>
          <span>Estado</span>
          <strong>{cashOpen === null ? "Cargando" : cashOpen ? "Caja abierta" : "Caja cerrada"}</strong>
        </div>
        <div>
          <span>Unidades</span>
          <strong>{lineCount}</strong>
        </div>
        <div className="is-total">
          <span>Total</span>
          <strong>{formatPrice(total)}</strong>
        </div>
      </section>

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
                disabled={!cashOpen || product.soldOut}
                onClick={() => addProduct(product)}
              >
                <span>{product.category}</span>
                <strong>{product.name}</strong>
                {product.soldOut && <small className="tpv-tile-stock">Agotado</small>}
                <em>{formatPrice(product.price)}</em>
              </button>
            ))}
          </section>
        </section>

        <aside className="tpv-ticket" aria-label="Ticket de barra">
          <div className="tpv-ticket-head tpv-bar-ticket-head">
            <div>
              <span>Ticket barra</span>
              <strong>{formatPrice(total)}</strong>
            </div>
            <ReceiptText aria-hidden="true" size={22} strokeWidth={2.2} />
          </div>

          <div className="tpv-ticket-block">
            <p>Ticket actual</p>
            {cart.length === 0 && (
              <span className="tpv-ticket-muted">Toca productos para añadirlos.</span>
            )}
            {cart.length > 0 && (
              <div className="tpv-ticket-lines">
                {cart.map((item) => (
                  <div className="tpv-ticket-line tpv-ticket-line-qty" key={item.id}>
                    <span>{item.name}</span>
                    <strong>{formatPrice(item.qty * item.price)}</strong>
                    <div className="tpv-qty">
                      <button type="button" onClick={() => removeProduct(item.id)} aria-label={`Quitar ${item.name}`}>
                        <Minus aria-hidden="true" size={15} strokeWidth={2.3} />
                      </button>
                      <span>{item.qty}</span>
                      <button type="button" onClick={() => addProduct(item)} aria-label={`Añadir ${item.name}`}>
                        <Plus aria-hidden="true" size={15} strokeWidth={2.3} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="tpv-ticket-total">
              <span>Total</span>
              <strong>{formatPrice(total)}</strong>
            </div>

            <div className="tpv-ticket-actions">
              <button
                className="tpv-button tpv-button-secondary"
                type="button"
                onClick={() => setCart([])}
                disabled={cart.length === 0 || selling}
              >
                <Trash2 aria-hidden="true" size={17} strokeWidth={2.2} />
                Vaciar
              </button>
              <button
                className="tpv-button"
                type="button"
                onClick={sellCart}
                disabled={cart.length === 0 || selling || !cashOpen}
              >
                {selling ? "Cobrando..." : "Cobrar"}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
