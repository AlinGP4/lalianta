"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatPrice } from "./data";

const emptyForm = {
  id: "",
  name: "",
  category: "",
  price: "",
  active: true,
};

const emptyCategoryForm = {
  id: "",
  name: "",
  active: true,
};

export default function ProductCrud() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [error, setError] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [activeTab, setActiveTab] = useState("products");

  const activeProducts = useMemo(
    () => products.filter((product) => product.active).length,
    [products],
  );
  const activeCategories = useMemo(
    () => categories.filter((category) => category.active),
    [categories],
  );

  async function loadCatalog() {
    setLoading(true);
    setError("");
    setCategoryError("");

    try {
      const [productsResponse, categoriesResponse] = await Promise.all([
        fetch("/api/products", { cache: "no-store" }),
        fetch("/api/categories", { cache: "no-store" }),
      ]);
      const productsData = await productsResponse.json();
      const categoriesData = await categoriesResponse.json();
      if (!productsResponse.ok) throw new Error(productsData.error || "No se pudieron cargar los productos");
      if (!categoriesResponse.ok) throw new Error(categoriesData.error || "No se pudieron cargar las categorias");
      setProducts(productsData.products);
      setCategories(categoriesData.categories);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCatalog();
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
      active: product.active,
    });
  }

  function resetForm() {
    setForm(emptyForm);
    setError("");
  }

  function updateCategoryField(field, value) {
    setCategoryForm((current) => ({ ...current, [field]: value }));
  }

  function editCategory(category) {
    setCategoryForm({
      id: category.id,
      name: category.name,
      active: category.active,
    });
  }

  function resetCategoryForm() {
    setCategoryForm(emptyCategoryForm);
    setCategoryError("");
  }

  async function saveProduct(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      name: form.name,
      category: form.category,
      price: Number(form.price),
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

      await loadCatalog();
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
      await loadCatalog();
      if (form.id === product.id) resetForm();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function saveCategory(event) {
    event.preventDefault();
    setSavingCategory(true);
    setCategoryError("");

    try {
      const response = await fetch(categoryForm.id ? `/api/categories/${categoryForm.id}` : "/api/categories", {
        method: categoryForm.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: categoryForm.name,
          active: categoryForm.active,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo guardar la categoria");

      await loadCatalog();
      resetCategoryForm();
    } catch (requestError) {
      setCategoryError(requestError.message);
    } finally {
      setSavingCategory(false);
    }
  }

  async function removeCategory(category) {
    const confirmed = window.confirm(`Eliminar categoria ${category.name}?`);
    if (!confirmed) return;

    setCategoryError("");

    try {
      const response = await fetch(`/api/categories/${category.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo eliminar la categoria");
      await loadCatalog();
      if (categoryForm.id === category.id) resetCategoryForm();
      if (form.category === category.name) updateField("category", "");
    } catch (requestError) {
      setCategoryError(requestError.message);
    }
  }

  return (
    <div className="tpv-product-admin-stack">
      <div className="tpv-product-tabs" role="tablist" aria-label="Gestion de carta">
        <button
          id="tpv-products-tab"
          className={activeTab === "products" ? "is-active" : ""}
          type="button"
          role="tab"
          aria-controls="productos"
          aria-selected={activeTab === "products"}
          onClick={() => setActiveTab("products")}
        >
          Productos
          <span>{activeProducts}</span>
        </button>
        <button
          id="tpv-categories-tab"
          className={activeTab === "categories" ? "is-active" : ""}
          type="button"
          role="tab"
          aria-controls="categorias"
          aria-selected={activeTab === "categories"}
          onClick={() => setActiveTab("categories")}
        >
          Categorias
          <span>{activeCategories.length}</span>
        </button>
      </div>

    {activeTab === "categories" && (
    <article className="tpv-panel tpv-products-panel" id="categorias" role="tabpanel" aria-labelledby="tpv-categories-tab">
      <div className="tpv-panel-head">
        <div>
          <p className="tpv-kicker">Carta</p>
          <h2>Categorias</h2>
        </div>
        <span className="tpv-count">{activeCategories.length} activas</span>
      </div>

      <form className="tpv-category-form" onSubmit={saveCategory}>
        <label>
          <span>Nombre</span>
          <input
            required
            value={categoryForm.name}
            onChange={(event) => updateCategoryField("name", event.target.value)}
            placeholder="Alcohol"
          />
        </label>
        <label className="tpv-check">
          <input
            checked={categoryForm.active}
            type="checkbox"
            onChange={(event) => updateCategoryField("active", event.target.checked)}
          />
          <span>Activa</span>
        </label>
        <div className="tpv-form-actions">
          <button className="tpv-button" type="submit" disabled={savingCategory}>
            {savingCategory ? "Guardando" : categoryForm.id ? "Actualizar" : "Crear"}
          </button>
          {categoryForm.id && (
            <button className="tpv-button tpv-button-secondary" type="button" onClick={resetCategoryForm}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      {categoryError && <div className="tpv-error">{categoryError}</div>}

      <div className="tpv-category-list">
        {loading && <span className="tpv-ticket-muted">Cargando categorias...</span>}
        {!loading && categories.length === 0 && <span className="tpv-ticket-muted">Todavia no hay categorias.</span>}
        {!loading && categories.map((category) => (
          <div className="tpv-category-item" key={category.id}>
            <div>
              <strong>{category.name}</strong>
              <span className={category.active ? "tpv-status is-active" : "tpv-status"}>{category.active ? "Activa" : "Oculta"}</span>
            </div>
            <div className="tpv-row-actions">
              <button type="button" onClick={() => editCategory(category)} aria-label={`Editar ${category.name}`} title="Editar">
                <Pencil aria-hidden="true" size={16} strokeWidth={2.2} />
              </button>
              <button type="button" onClick={() => removeCategory(category)} aria-label={`Borrar ${category.name}`} title="Borrar">
                <Trash2 aria-hidden="true" size={16} strokeWidth={2.2} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </article>
    )}

    {activeTab === "products" && (
    <article className="tpv-panel tpv-products-panel" id="productos" role="tabpanel" aria-labelledby="tpv-products-tab">
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
            required
            value={form.category}
            onChange={(event) => updateField("category", event.target.value)}
          >
            <option value="">Seleccionar</option>
            {categories.map((category) => (
              <option key={category.id} value={category.name} disabled={!category.active}>
                {category.name}{category.active ? "" : " (oculta)"}
              </option>
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
              <th>Precio</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="5">Cargando productos...</td>
              </tr>
            )}
            {!loading && products.length === 0 && (
              <tr>
                <td colSpan="5">Todavia no hay productos.</td>
              </tr>
            )}
            {!loading && products.map((product) => (
              <tr key={product.id}>
                <td>{product.name}</td>
                <td>{product.category}</td>
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
    )}
    </div>
  );
}
