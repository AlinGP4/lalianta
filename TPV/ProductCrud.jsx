"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { categories, formatPrice } from "./data";

const emptyForm = {
  id: "",
  name: "",
  category: "Vinos",
  price: "",
  stock: "0",
  active: true,
};

export default function ProductCrud() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const activeProducts = useMemo(
    () => products.filter((product) => product.active).length,
    [products],
  );

  async function loadProducts() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/products", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudieron cargar los productos");
      setProducts(data.products);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function editProduct(product) {
    setForm({
      id: product.id,
      name: product.name,
      category: product.category,
      price: String(product.price),
      stock: String(product.stock),
      active: product.active,
    });
  }

  function resetForm() {
    setForm(emptyForm);
    setError("");
  }

  async function saveProduct(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      name: form.name,
      category: form.category,
      price: Number(form.price),
      stock: Number.parseInt(form.stock, 10),
      active: form.active,
    };

    try {
      const response = await fetch(form.id ? `/api/products/${form.id}` : "/api/products", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo guardar el producto");

      await loadProducts();
      resetForm();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeProduct(product) {
    const confirmed = window.confirm(`Eliminar ${product.name}?`);
    if (!confirmed) return;

    setError("");

    try {
      const response = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo eliminar el producto");
      await loadProducts();
      if (form.id === product.id) resetForm();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <article className="tpv-panel tpv-products-panel" id="productos">
      <div className="tpv-panel-head">
        <div>
          <p className="tpv-kicker">Carta</p>
          <h2>Productos</h2>
        </div>
        <span className="tpv-count">{activeProducts} activos</span>
      </div>

      <form className="tpv-product-form" onSubmit={saveProduct}>
        <label>
          <span>Nombre</span>
          <input
            required
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="Vermut casa"
          />
        </label>
        <label>
          <span>Categoria</span>
          <select
            value={form.category}
            onChange={(event) => updateField("category", event.target.value)}
          >
            {categories.filter((category) => category !== "Todo").map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Precio</span>
          <input
            required
            min="0"
            step="0.01"
            type="number"
            value={form.price}
            onChange={(event) => updateField("price", event.target.value)}
            placeholder="3.50"
          />
        </label>
        <label>
          <span>Stock</span>
          <input
            required
            min="0"
            step="1"
            type="number"
            value={form.stock}
            onChange={(event) => updateField("stock", event.target.value)}
          />
        </label>
        <label className="tpv-check">
          <input
            checked={form.active}
            type="checkbox"
            onChange={(event) => updateField("active", event.target.checked)}
          />
          <span>Activo</span>
        </label>
        <div className="tpv-form-actions">
          <button className="tpv-button" type="submit" disabled={saving}>
            {saving ? "Guardando" : form.id ? "Actualizar" : "Crear"}
          </button>
          {form.id && (
            <button className="tpv-button tpv-button-secondary" type="button" onClick={resetForm}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      {error && <div className="tpv-error">{error}</div>}

      <div className="tpv-table-wrap">
        <table className="tpv-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Categoria</th>
              <th>Stock</th>
              <th>Precio</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="6">Cargando productos...</td>
              </tr>
            )}
            {!loading && products.length === 0 && (
              <tr>
                <td colSpan="6">Todavia no hay productos.</td>
              </tr>
            )}
            {!loading && products.map((product) => (
              <tr key={product.id}>
                <td>{product.name}</td>
                <td>{product.category}</td>
                <td>{product.stock}</td>
                <td>{formatPrice(product.price)}</td>
                <td>
                  <span className={product.active ? "tpv-status is-active" : "tpv-status"}>
                    {product.active ? "Activo" : "Oculto"}
                  </span>
                </td>
                <td>
                  <div className="tpv-row-actions">
                    <button
                      type="button"
                      onClick={() => editProduct(product)}
                      aria-label={`Editar ${product.name}`}
                      title="Editar"
                    >
                      <Pencil aria-hidden="true" size={16} strokeWidth={2.2} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeProduct(product)}
                      aria-label={`Borrar ${product.name}`}
                      title="Borrar"
                    >
                      <Trash2 aria-hidden="true" size={16} strokeWidth={2.2} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
