"use client";

import { Check, Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { categories, formatPrice, products } from "./data";

export default function CustomerOrder({ tableNumber = "" }) {
  const [category, setCategory] = useState("Todo");
  const [cart, setCart] = useState([]);
  const [sending, setSending] = useState(false);
  const [sentCode, setSentCode] = useState("");
  const [error, setError] = useState("");

  const filteredProducts = useMemo(() => {
    if (category === "Todo") return products;
    return products.filter((product) => product.category === category);
  }, [category]);

  const total = cart.reduce((sum, item) => sum + item.qty * item.price, 0);

  function addProduct(product) {
    setSentCode("");
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

  async function sendOrder() {
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
            productName: item.name,
            quantity: item.qty,
            price: item.price,
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
        <div className="customer-success">
          <Check aria-hidden="true" size={18} strokeWidth={2.4} />
          Pedido enviado al bar
        </div>
      )}

      {error && <div className="tpv-error">{error}</div>}

      <section className="customer-tabs" aria-label="Categorias">
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
        {filteredProducts.map((product) => (
          <button className="customer-product" type="button" key={product.id} onClick={() => addProduct(product)}>
            <span>{product.category}</span>
            <strong>{product.name}</strong>
            <em>{formatPrice(product.price)}</em>
          </button>
        ))}
      </section>

      <section className="customer-cart" aria-label="Carrito">
        <div className="customer-cart-head">
          <strong>Tu pedido</strong>
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
              <div className="customer-qty">
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
        <button className="tpv-button" type="button" onClick={sendOrder} disabled={cart.length === 0 || sending || !tableNumber}>
          {sending ? "Enviando" : "Enviar al bar"}
        </button>
      </section>
    </main>
  );
}
