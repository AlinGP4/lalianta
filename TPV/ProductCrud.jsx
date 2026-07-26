"use client";

import {
  closestCenter,
  DragOverlay,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowRight, Ban, CheckCircle2, GripVertical, Pencil, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { subscribeToCatalogChanges } from "./catalogRealtime";
import ConfirmModal from "./ConfirmModal";
import { formatPrice } from "./data";

const emptyForm = {
  id: "",
  name: "",
  category: "",
  price: "",
  soldOut: false,
  active: true,
};

const emptyCategoryForm = {
  id: "",
  name: "",
  kind: "product",
  active: true,
};

function normalizeCategory(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("es-ES");
}

function parseSupplementCents(value) {
  const supplementCents = Math.round(Number(String(value ?? "").replace(",", ".")) * 100);
  if (!Number.isFinite(supplementCents) || supplementCents < 0) return 0;
  return supplementCents;
}

function formatSupplementInput(supplementCents) {
  return supplementCents > 0 ? (supplementCents / 100).toFixed(2) : "";
}

export default function ProductCrud() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [sortingCategories, setSortingCategories] = useState(false);
  const [sortingProducts, setSortingProducts] = useState(false);
  const [activeProductId, setActiveProductId] = useState("");
  const [dragOverlayWidth, setDragOverlayWidth] = useState(0);
  const [productFilters, setProductFilters] = useState({
    category: "all",
    order: "manual",
    query: "",
    status: "all",
  });
  const [collections, setCollections] = useState([]);
  const [collectionQuery, setCollectionQuery] = useState("");
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [savingCollection, setSavingCollection] = useState(false);
  const [collectionError, setCollectionError] = useState("");
  const [categoryQuery, setCategoryQuery] = useState("");
  const [organizeCategory, setOrganizeCategory] = useState("");
  const [error, setError] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [cubataError, setCubataError] = useState("");
  const [cubataConfigs, setCubataConfigs] = useState([]);
  const [selectedCubataAlcoholId, setSelectedCubataAlcoholId] = useState("");
  const [savingCubataConfig, setSavingCubataConfig] = useState(false);
  const [bulkSupplement, setBulkSupplement] = useState("");
  const [activeTab, setActiveTab] = useState("products");
  const [confirmModal, setConfirmModal] = useState(null);
  const productOrderListRef = useRef(null);

  const availableProducts = useMemo(
    () => products.filter((product) => product.active && !product.soldOut).length,
    [products],
  );
  const activeCategories = useMemo(
    () => categories.filter((category) => category.active),
    [categories],
  );
  const productCategories = useMemo(
    () => categories.filter((category) => category.kind !== "collection"),
    [categories],
  );
  const collectionCategories = useMemo(
    () => categories.filter((category) => category.kind === "collection"),
    [categories],
  );
  const selectedCollectionCategory = useMemo(
    () => collectionCategories.find((category) => category.id === selectedCollectionId),
    [collectionCategories, selectedCollectionId],
  );
  const collectionProductIds = useMemo(
    () => collections.find((collection) => collection.categoryId === selectedCollectionId)?.productIds ?? [],
    [collections, selectedCollectionId],
  );
  const collectionProducts = useMemo(
    () => collectionProductIds.map((id) => products.find((product) => product.id === id)).filter(Boolean),
    [collectionProductIds, products],
  );
  const collectionItemCounts = useMemo(
    () => new Map(collections.map((collection) => [collection.categoryId, collection.productIds.length])),
    [collections],
  );
  const collectionCandidates = useMemo(() => {
    const normalizedQuery = collectionQuery.trim().toLocaleLowerCase("es-ES");

    return products.filter((product) => {
      if (!product.active) return false;
      if (!normalizedQuery) return true;
      return product.name.toLocaleLowerCase("es-ES").includes(normalizedQuery)
        || product.category.toLocaleLowerCase("es-ES").includes(normalizedQuery);
    });
  }, [collectionQuery, products]);
  const filteredCategories = useMemo(() => {
    const normalizedQuery = categoryQuery.trim().toLocaleLowerCase("es-ES");
    if (!normalizedQuery) return categories;

    return categories.filter((category) => (
      category.name.toLocaleLowerCase("es-ES").includes(normalizedQuery)
    ));
  }, [categories, categoryQuery]);
  const categoryIds = useMemo(
    () => filteredCategories.map((category) => category.id),
    [filteredCategories],
  );
  const categorySortingDisabled = categoryQuery.trim() !== "";
  const organizeProducts = useMemo(
    () => products.filter((product) => product.category === organizeCategory),
    [organizeCategory, products],
  );
  const organizeProductIds = useMemo(
    () => organizeProducts.map((product) => product.id),
    [organizeProducts],
  );
  const productIds = useMemo(() => products.map((product) => product.id), [products]);
  const filteredProducts = useMemo(() => {
    const normalizedQuery = productFilters.query.trim().toLocaleLowerCase("es-ES");

    const nextProducts = products.filter((product) => {
      const matchesQuery = !normalizedQuery
        || product.name.toLocaleLowerCase("es-ES").includes(normalizedQuery)
        || product.category.toLocaleLowerCase("es-ES").includes(normalizedQuery);
      const matchesCategory = productFilters.category === "all" || product.category === productFilters.category;
      const matchesStatus = productFilters.status === "all"
        || (productFilters.status === "available" && product.active && !product.soldOut)
        || (productFilters.status === "soldOut" && product.soldOut)
        || (productFilters.status === "hidden" && !product.active);

      return matchesQuery && matchesCategory && matchesStatus;
    });

    if (productFilters.order === "name") {
      return [...nextProducts].sort((first, second) => first.name.localeCompare(second.name, "es"));
    }
    if (productFilters.order === "category") {
      return [...nextProducts].sort((first, second) => (
        first.category.localeCompare(second.category, "es") || first.name.localeCompare(second.name, "es")
      ));
    }
    if (productFilters.order === "priceAsc") {
      return [...nextProducts].sort((first, second) => first.price - second.price);
    }
    if (productFilters.order === "priceDesc") {
      return [...nextProducts].sort((first, second) => second.price - first.price);
    }

    return nextProducts;
  }, [productFilters, products]);
  const filteredProductIds = useMemo(() => filteredProducts.map((product) => product.id), [filteredProducts]);
  const productFiltersActive = productFilters.category !== "all"
    || productFilters.order !== "manual"
    || productFilters.query.trim() !== ""
    || productFilters.status !== "all";
  const productCategoryOrderMode = productFilters.category !== "all"
    && productFilters.order === "manual"
    && productFilters.query.trim() === ""
    && productFilters.status === "all";
  const productSortingDisabled = productFiltersActive && !productCategoryOrderMode;
  const activeDraggedProduct = useMemo(
    () => products.find((product) => product.id === activeProductId),
    [activeProductId, products],
  );
  const alcoholProducts = useMemo(
    () => products.filter((product) => product.active && normalizeCategory(product.category) === "alcohol"),
    [products],
  );
  const refrescoProducts = useMemo(
    () => products.filter((product) => product.active && normalizeCategory(product.category) === "refresco"),
    [products],
  );
  const selectedCubataConfig = useMemo(
    () => cubataConfigs.find((config) => config.alcoholProductId === selectedCubataAlcoholId),
    [cubataConfigs, selectedCubataAlcoholId],
  );
  const selectedMixers = useMemo(
    () => selectedCubataConfig?.mixers ?? [],
    [selectedCubataConfig],
  );
  const selectedMixerIds = useMemo(
    () => selectedMixers.map((mixer) => mixer.productId),
    [selectedMixers],
  );
  const selectedMixerProducts = useMemo(
    () => selectedMixers
      .map((mixer) => {
        const product = refrescoProducts.find((item) => item.id === mixer.productId);
        return product ? { ...product, supplementCents: mixer.supplementCents ?? 0 } : null;
      })
      .filter(Boolean),
    [refrescoProducts, selectedMixers],
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function loadCatalog() {
    setLoading(true);
    setError("");
    setCategoryError("");
    setCubataError("");
    setCollectionError("");

    try {
      const [productsResponse, categoriesResponse, cubatasResponse, collectionsResponse] = await Promise.all([
        fetch("/api/products", { cache: "no-store" }),
        fetch("/api/categories", { cache: "no-store" }),
        fetch("/api/cubatas", { cache: "no-store" }),
        fetch("/api/collections", { cache: "no-store" }),
      ]);
      const productsData = await productsResponse.json();
      const categoriesData = await categoriesResponse.json();
      const cubatasData = await cubatasResponse.json();
      const collectionsData = await collectionsResponse.json();
      if (!productsResponse.ok) throw new Error(productsData.error || "No se pudieron cargar los productos");
      if (!categoriesResponse.ok) throw new Error(categoriesData.error || "No se pudieron cargar las categorías");
      if (!cubatasResponse.ok) throw new Error(cubatasData.error || "No se pudo cargar el modo cubata");
      if (!collectionsResponse.ok) throw new Error(collectionsData.error || "No se pudieron cargar las colecciones");
      setProducts(productsData.products);
      setCategories(categoriesData.categories);
      setCubataConfigs(cubatasData.configs);
      setCollections(collectionsData.collections);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCatalog();
  }, []);

  useEffect(() => (
    subscribeToCatalogChanges(() => {
      loadCatalog();
    })
  ), []);

  useEffect(() => {
    if (activeTab !== "cubatas") return;
    if (alcoholProducts.length === 0) return;
    if (alcoholProducts.some((product) => product.id === selectedCubataAlcoholId)) return;
    setSelectedCubataAlcoholId(alcoholProducts[0].id);
  }, [activeTab, alcoholProducts, selectedCubataAlcoholId]);

  useEffect(() => {
    if (activeTab !== "collections") return;
    if (collectionCategories.length === 0) return;
    if (collectionCategories.some((category) => category.id === selectedCollectionId)) return;
    setSelectedCollectionId(collectionCategories[0].id);
  }, [activeTab, collectionCategories, selectedCollectionId]);

  useEffect(() => {
    if (productCategories.length === 0) return;
    if (productCategories.some((category) => category.name === organizeCategory)) return;
    setOrganizeCategory(productCategories[0].name);
  }, [productCategories, organizeCategory]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateProductFilter(field, value) {
    setProductFilters((current) => ({ ...current, [field]: value }));
  }

  function resetProductFilters() {
    setProductFilters({
      category: "all",
      order: "manual",
      query: "",
      status: "all",
    });
  }

  function editProduct(product) {
    setForm({
      id: product.id,
      name: product.name,
      category: product.category,
      price: String(product.price),
      soldOut: product.soldOut,
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
      kind: category.kind ?? "product",
      active: category.active,
    });
  }

  function resetCategoryForm() {
    setCategoryForm(emptyCategoryForm);
    setCategoryError("");
  }

  function openCategoryContent(category) {
    if (category.kind === "collection") {
      setSelectedCollectionId(category.id);
      setActiveTab("collections");
      return;
    }

    setOrganizeCategory(category.name);
    setActiveTab("organize");
  }

  function setLocalCollection(categoryId, productIds) {
    setCollections((current) => {
      const nextCollection = { categoryId, productIds };
      if (current.some((collection) => collection.categoryId === categoryId)) {
        return current.map((collection) => (
          collection.categoryId === categoryId ? nextCollection : collection
        ));
      }

      return [...current, nextCollection];
    });
  }

  async function saveCollection(categoryId, productIds) {
    setSavingCollection(true);
    setCollectionError("");

    try {
      const response = await fetch("/api/collections", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, productIds }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo guardar la colección");
      setCollections(data.collections);
    } catch (requestError) {
      setCollectionError(requestError.message);
      await loadCatalog();
    } finally {
      setSavingCollection(false);
    }
  }

  function toggleCollectionProduct(product) {
    if (!selectedCollectionId || savingCollection) return;

    const nextProductIds = collectionProductIds.includes(product.id)
      ? collectionProductIds.filter((id) => id !== product.id)
      : [...collectionProductIds, product.id];

    setLocalCollection(selectedCollectionId, nextProductIds);
    saveCollection(selectedCollectionId, nextProductIds);
  }

  function handleCollectionDragEnd(event) {
    const { active, over } = event;
    if (!selectedCollectionId || !over || active.id === over.id) return;

    const oldIndex = collectionProductIds.findIndex((id) => id === active.id);
    const newIndex = collectionProductIds.findIndex((id) => id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const nextProductIds = arrayMove(collectionProductIds, oldIndex, newIndex);
    setLocalCollection(selectedCollectionId, nextProductIds);
    saveCollection(selectedCollectionId, nextProductIds);
  }

  async function saveProduct(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      name: form.name,
      category: form.category,
      price: Number(form.price),
      soldOut: form.soldOut,
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

  async function toggleProductSoldOut(product) {
    setError("");

    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          soldOut: !product.soldOut,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo actualizar el producto");

      setProducts((current) => current.map((item) => (
        item.id === product.id ? data.product : item
      )));
      if (form.id === product.id) {
        setForm((current) => ({ ...current, soldOut: data.product.soldOut }));
      }
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function saveProductOrder(nextProducts) {
    setSortingProducts(true);
    setError("");

    try {
      const response = await fetch("/api/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: nextProducts.map((product) => product.id) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo guardar el orden");
      setProducts(data.products);
    } catch (requestError) {
      setError(requestError.message);
      await loadCatalog();
    } finally {
      setSortingProducts(false);
    }
  }

  function handleProductDragEnd(event) {
    if (productSortingDisabled) return;
    const { active, over } = event;
    setActiveProductId("");
    setDragOverlayWidth(0);
    if (!over || active.id === over.id) return;

    const draggableProducts = productCategoryOrderMode ? filteredProducts : products;
    const oldIndex = draggableProducts.findIndex((product) => product.id === active.id);
    const newIndex = draggableProducts.findIndex((product) => product.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const nextDraggableProducts = arrayMove(draggableProducts, oldIndex, newIndex);
    const reorderedCategoryProducts = [...nextDraggableProducts];
    const nextProducts = productCategoryOrderMode
      ? products.map((product) => {
        if (product.category !== productFilters.category) return product;
        return reorderedCategoryProducts.shift() ?? product;
      })
      : nextDraggableProducts;

    setProducts(nextProducts);
    saveProductOrder(productCategoryOrderMode ? nextDraggableProducts : nextProducts);
  }

  function handleOrganizeDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = organizeProducts.findIndex((product) => product.id === active.id);
    const newIndex = organizeProducts.findIndex((product) => product.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const nextOrganizeProducts = arrayMove(organizeProducts, oldIndex, newIndex);
    const queue = [...nextOrganizeProducts];
    const nextProducts = products.map((product) => (
      product.category === organizeCategory ? queue.shift() ?? product : product
    ));

    setProducts(nextProducts);
    saveProductOrder(nextOrganizeProducts);
  }

  function handleProductDragStart(event) {
    if (productSortingDisabled) return;
    setActiveProductId(String(event.active.id));
    const activeNode = event.active.rect.current.initial;
    const fallbackWidth = productOrderListRef.current?.getBoundingClientRect().width ?? 0;
    setDragOverlayWidth(Math.round(activeNode?.width ?? fallbackWidth));
  }

  async function saveCategoryOrder(nextCategories) {
    setSortingCategories(true);
    setCategoryError("");

    try {
      const response = await fetch("/api/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryIds: nextCategories.map((category) => category.id) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo guardar el orden de categorías");
      setCategories(data.categories);
      await loadCatalog();
    } catch (requestError) {
      setCategoryError(requestError.message);
      await loadCatalog();
    } finally {
      setSortingCategories(false);
    }
  }

  function handleCategoryDragEnd(event) {
    const { active, over } = event;
    if (categorySortingDisabled || !over || active.id === over.id) return;

    const oldIndex = categories.findIndex((category) => category.id === active.id);
    const newIndex = categories.findIndex((category) => category.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const nextCategories = arrayMove(categories, oldIndex, newIndex);
    setCategories(nextCategories);
    saveCategoryOrder(nextCategories);
  }

  function setLocalCubataConfig(alcoholProductId, mixers) {
    setCubataConfigs((current) => {
      const nextConfig = {
        alcoholProductId,
        mixerProductIds: mixers.map((mixer) => mixer.productId),
        mixers,
      };
      if (current.some((config) => config.alcoholProductId === alcoholProductId)) {
        return current.map((config) => (
          config.alcoholProductId === alcoholProductId ? nextConfig : config
        ));
      }

      return [...current, nextConfig];
    });
  }

  async function saveCubataConfig(alcoholProductId, mixers) {
    setSavingCubataConfig(true);
    setCubataError("");

    try {
      const response = await fetch("/api/cubatas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alcoholProductId, mixers }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo guardar el modo cubata");
      setCubataConfigs(data.configs);
    } catch (requestError) {
      setCubataError(requestError.message);
      await loadCatalog();
    } finally {
      setSavingCubataConfig(false);
    }
  }

  function applyCubataMixers(mixers) {
    setLocalCubataConfig(selectedCubataAlcoholId, mixers);
    saveCubataConfig(selectedCubataAlcoholId, mixers);
  }

  function toggleCubataMixer(refrescoProduct) {
    if (!selectedCubataAlcoholId || savingCubataConfig) return;

    const nextMixers = selectedMixerIds.includes(refrescoProduct.id)
      ? selectedMixers.filter((mixer) => mixer.productId !== refrescoProduct.id)
      : [...selectedMixers, { productId: refrescoProduct.id, supplementCents: 0 }];

    applyCubataMixers(nextMixers);
  }

  function setCubataMixerSupplement(refrescoProductId, supplementCents) {
    if (!selectedCubataAlcoholId || savingCubataConfig) return;

    const currentMixer = selectedMixers.find((mixer) => mixer.productId === refrescoProductId);
    if (!currentMixer || (currentMixer.supplementCents ?? 0) === supplementCents) return;

    applyCubataMixers(selectedMixers.map((mixer) => (
      mixer.productId === refrescoProductId ? { ...mixer, supplementCents } : mixer
    )));
  }

  function setAllCubataMixerSupplements(supplementCents) {
    if (!selectedCubataAlcoholId || savingCubataConfig || selectedMixers.length === 0) return;

    applyCubataMixers(selectedMixers.map((mixer) => ({ ...mixer, supplementCents })));
  }

  function handleCubataMixerDragEnd(event) {
    const { active, over } = event;
    if (!selectedCubataAlcoholId || !over || active.id === over.id) return;

    const oldIndex = selectedMixerIds.findIndex((id) => id === active.id);
    const newIndex = selectedMixerIds.findIndex((id) => id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    applyCubataMixers(arrayMove(selectedMixers, oldIndex, newIndex));
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
          kind: categoryForm.kind,
          active: categoryForm.active,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo guardar la categoría");

      await loadCatalog();
      resetCategoryForm();
    } catch (requestError) {
      setCategoryError(requestError.message);
    } finally {
      setSavingCategory(false);
    }
  }

  async function toggleCategoryActive(category) {
    setCategoryError("");

    try {
      const response = await fetch(`/api/categories/${category.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: category.name,
          kind: category.kind,
          active: !category.active,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo actualizar la categoría");
      await loadCatalog();
      if (categoryForm.id === category.id) {
        editCategory(data.category);
      }
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
          <span>{availableProducts}</span>
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
          Categorías
          <span>{activeCategories.length}</span>
        </button>
        <button
          id="tpv-organize-tab"
          className={activeTab === "organize" ? "is-active" : ""}
          type="button"
          role="tab"
          aria-controls="organizacion"
          aria-selected={activeTab === "organize"}
          onClick={() => setActiveTab("organize")}
        >
          Organización
          <span>{organizeProducts.length}</span>
        </button>
        <button
          id="tpv-collections-tab"
          className={activeTab === "collections" ? "is-active" : ""}
          type="button"
          role="tab"
          aria-controls="colecciones"
          aria-selected={activeTab === "collections"}
          onClick={() => setActiveTab("collections")}
        >
          Colecciones
          <span>{collectionCategories.length}</span>
        </button>
        <button
          id="tpv-cubatas-tab"
          className={activeTab === "cubatas" ? "is-active" : ""}
          type="button"
          role="tab"
          aria-controls="cubatas"
          aria-selected={activeTab === "cubatas"}
          onClick={() => setActiveTab("cubatas")}
        >
          Cubatas
          <span>{alcoholProducts.length}</span>
        </button>
      </div>

    {activeTab === "categories" && (
    <article className="tpv-panel tpv-products-panel" id="categorias" role="tabpanel" aria-labelledby="tpv-categories-tab">
      <div className="tpv-panel-head">
        <div>
          <p className="tpv-kicker">Carta</p>
          <h2>Categorías</h2>
        </div>
        <span className="tpv-count">{sortingCategories ? "Guardando orden..." : `${activeCategories.length} activas`}</span>
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
        <label>
          <span>Tipo</span>
          <select
            value={categoryForm.kind}
            onChange={(event) => updateCategoryField("kind", event.target.value)}
          >
            <option value="product">Categoría de productos</option>
            <option value="collection">Colección de categorías</option>
          </select>
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

      <section className="tpv-category-filters" aria-label="Filtros de categorías">
        <label>
          <span>Buscar</span>
          <input
            value={categoryQuery}
            onChange={(event) => setCategoryQuery(event.target.value)}
            placeholder="Nombre de categoría"
          />
        </label>
        <button
          className="tpv-button tpv-button-secondary"
          type="button"
          onClick={() => setCategoryQuery("")}
          disabled={!categorySortingDisabled}
        >
          Limpiar filtro
        </button>
      </section>

      {categorySortingDisabled && (
        <p className="tpv-product-filter-note">
          Mostrando {filteredCategories.length} de {categories.length}. Limpia el filtro para ordenar manualmente.
        </p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
        <SortableContext items={categoryIds} strategy={verticalListSortingStrategy}>
          <div className="tpv-category-list">
            {loading && <span className="tpv-ticket-muted">Cargando categorías...</span>}
            {!loading && categories.length === 0 && <span className="tpv-ticket-muted">Todavía no hay categorías.</span>}
            {!loading && categories.length > 0 && filteredCategories.length === 0 && (
              <span className="tpv-ticket-muted">No hay categorías con ese nombre.</span>
            )}
            {!loading && filteredCategories.map((category) => (
              <SortableCategoryItem
                category={category}
                key={category.id}
                disabled={categorySortingDisabled}
                itemCount={collectionItemCounts.get(category.id) ?? 0}
                onEdit={editCategory}
                onOpen={openCategoryContent}
                onToggleActive={toggleCategoryActive}
                setConfirmModal={setConfirmModal}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </article>
    )}

    {activeTab === "organize" && (
    <article className="tpv-panel tpv-products-panel" id="organizacion" role="tabpanel" aria-labelledby="tpv-organize-tab">
      <div className="tpv-panel-head">
        <div>
          <p className="tpv-kicker">Carta</p>
          <h2>Organización</h2>
        </div>
        <span className="tpv-count">
          {sortingProducts ? "Guardando orden..." : `${organizeProducts.length} productos`}
        </span>
      </div>

      {error && <div className="tpv-error">{error}</div>}

      {productCategories.length === 0 && (
        <div className="tpv-history-empty">
          Crea una categoría de productos para poder ordenar su contenido.
        </div>
      )}

      {productCategories.length > 0 && (
        <div className="tpv-collection-config">
          <label className="tpv-cubata-selector">
            <span>Categoría</span>
            <select value={organizeCategory} onChange={(event) => setOrganizeCategory(event.target.value)}>
              {productCategories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}{category.active ? "" : " (oculta)"}
                </option>
              ))}
            </select>
          </label>

          <p className="tpv-product-filter-note">
            Arrastra para fijar el orden en que se ven dentro de {organizeCategory || "la categoría"} al pedir.
          </p>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleOrganizeDragEnd}>
            <SortableContext items={organizeProductIds} strategy={verticalListSortingStrategy}>
              <div className="tpv-collection-sort-list tpv-organize-list">
                {loading && <span className="tpv-ticket-muted">Cargando productos...</span>}
                {!loading && organizeProducts.length === 0 && (
                  <span className="tpv-ticket-muted">No hay productos en esta categoría.</span>
                )}
                {!loading && organizeProducts.map((product) => (
                  <SortableOrganizeItem key={product.id} product={product} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </article>
    )}

    {activeTab === "collections" && (
    <article className="tpv-panel tpv-products-panel" id="colecciones" role="tabpanel" aria-labelledby="tpv-collections-tab">
      <div className="tpv-panel-head">
        <div>
          <p className="tpv-kicker">Carta</p>
          <h2>Colecciones</h2>
        </div>
        <span className="tpv-count">
          {savingCollection ? "Guardando..." : `${collectionProductIds.length} productos`}
        </span>
      </div>

      {collectionError && <div className="tpv-error">{collectionError}</div>}

      {collectionCategories.length === 0 && (
        <div className="tpv-history-empty">
          Crea una categoría de tipo colección para agrupar aquí productos de otras categorías.
        </div>
      )}

      {collectionCategories.length > 0 && (
        <div className="tpv-collection-config">
          <label className="tpv-cubata-selector">
            <span>Colección</span>
            <select value={selectedCollectionId} onChange={(event) => setSelectedCollectionId(event.target.value)}>
              {collectionCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}{category.active ? "" : " (oculta)"}
                </option>
              ))}
            </select>
          </label>

          <p className="tpv-product-filter-note">
            Los productos que elijas seguirán apareciendo también en su categoría original.
          </p>

          <div className="tpv-collection-grid">
            <div className="tpv-collection-column">
              <label className="tpv-collection-search">
                <span>Buscar producto</span>
                <input
                  value={collectionQuery}
                  onChange={(event) => setCollectionQuery(event.target.value)}
                  placeholder="Nombre o categoría"
                />
              </label>
              <div className="tpv-collection-option-list">
                {collectionCandidates.length === 0 && (
                  <span className="tpv-ticket-muted">No hay productos activos con esa búsqueda.</span>
                )}
                {collectionCandidates.map((product) => {
                  const selected = collectionProductIds.includes(product.id);

                  return (
                    <button
                      className={selected ? "is-selected" : ""}
                      key={product.id}
                      type="button"
                      onClick={() => toggleCollectionProduct(product)}
                    >
                      <span>{product.name}</span>
                      <em>{product.category}</em>
                      <strong>{selected ? "Incluido" : "Añadir"}</strong>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="tpv-collection-column">
              <h4>Orden para el cliente</h4>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCollectionDragEnd}>
                <SortableContext items={collectionProductIds} strategy={verticalListSortingStrategy}>
                  <div className="tpv-collection-sort-list">
                    {collectionProducts.length === 0 && (
                      <span className="tpv-ticket-muted">
                        Todavía no has añadido productos a {selectedCollectionCategory?.name ?? "esta colección"}.
                      </span>
                    )}
                    {collectionProducts.map((product) => (
                      <SortableMixerItem key={product.id} product={product} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </div>
        </div>
      )}
    </article>
    )}

    {activeTab === "cubatas" && (
    <article className="tpv-panel tpv-products-panel" id="cubatas" role="tabpanel" aria-labelledby="tpv-cubatas-tab">
      <div className="tpv-panel-head">
        <div>
          <p className="tpv-kicker">Carta</p>
          <h2>Modo cubata</h2>
        </div>
        <span className="tpv-count">{savingCubataConfig ? "Guardando..." : `${selectedMixerIds.length} refrescos`}</span>
      </div>

      {cubataError && <div className="tpv-error">{cubataError}</div>}

      {(alcoholProducts.length === 0 || refrescoProducts.length === 0) && (
        <div className="tpv-history-empty">
          Crea productos activos en categorías Alcohol y Refresco para configurar cubatas.
        </div>
      )}

      {alcoholProducts.length > 0 && refrescoProducts.length > 0 && (
        <div className="tpv-cubata-config">
          <label className="tpv-cubata-selector">
            <span>Alcohol</span>
            <select
              value={selectedCubataAlcoholId}
              onChange={(event) => {
                setSelectedCubataAlcoholId(event.target.value);
                setBulkSupplement("");
              }}
            >
              {alcoholProducts.map((product) => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </select>
          </label>

          <section className="tpv-cubata-grid" aria-label="Configuración de refrescos para cubata">
            <div className="tpv-cubata-column">
              <h3>Refrescos disponibles</h3>
              <div className="tpv-cubata-option-list">
                {refrescoProducts.map((product) => {
                  const selected = selectedMixerIds.includes(product.id);

                  return (
                    <button
                      className={selected ? "is-selected" : ""}
                      key={product.id}
                      type="button"
                      onClick={() => toggleCubataMixer(product)}
                    >
                      <span>{product.name}</span>
                      <strong>{selected ? "Incluido" : "Añadir"}</strong>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="tpv-cubata-column">
              <h3>Orden y suplementos</h3>
              <p className="tpv-product-filter-note">
                El suplemento se suma al precio del cubata para esa combinación de alcohol y refresco.
              </p>
              {selectedMixerProducts.length > 0 && (
                <div className="tpv-cubata-bulk-supplement">
                  <label>
                    <span>Suplemento para todos</span>
                    <input
                      min="0"
                      step="0.10"
                      type="number"
                      value={bulkSupplement}
                      onChange={(event) => setBulkSupplement(event.target.value)}
                      placeholder="0,00"
                    />
                  </label>
                  <button
                    className="tpv-button tpv-button-secondary"
                    type="button"
                    disabled={savingCubataConfig || bulkSupplement === ""}
                    onClick={() => {
                      setAllCubataMixerSupplements(parseSupplementCents(bulkSupplement));
                      setBulkSupplement("");
                    }}
                  >
                    Aplicar
                  </button>
                </div>
              )}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCubataMixerDragEnd}>
                <SortableContext items={selectedMixerIds} strategy={verticalListSortingStrategy}>
                  <div className="tpv-cubata-sort-list">
                    {selectedMixerProducts.length === 0 && (
                      <span className="tpv-ticket-muted">Selecciona refrescos para este alcohol.</span>
                    )}
                    {selectedMixerProducts.map((product) => (
                      <SortableMixerItem
                        key={product.id}
                        product={product}
                        supplementCents={product.supplementCents}
                        onSupplementChange={setCubataMixerSupplement}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </section>
        </div>
      )}
    </article>
    )}

    {activeTab === "products" && (
    <article className="tpv-panel tpv-products-panel" id="productos" role="tabpanel" aria-labelledby="tpv-products-tab">
      <div className="tpv-panel-head">
        <div>
          <p className="tpv-kicker">Carta</p>
          <h2>Productos</h2>
        </div>
        <span className="tpv-count">{sortingProducts ? "Guardando orden..." : `${availableProducts} disponibles`}</span>
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
          <span>Categoría</span>
          <select
            required
            value={form.category}
            onChange={(event) => updateField("category", event.target.value)}
          >
            <option value="">Seleccionar</option>
            {productCategories.map((category) => (
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
            checked={form.soldOut}
            type="checkbox"
            onChange={(event) => updateField("soldOut", event.target.checked)}
          />
          <span>Agotado</span>
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

      <section className="tpv-product-filters" aria-label="Filtros de productos">
        <label>
          <span>Buscar</span>
          <input
            value={productFilters.query}
            onChange={(event) => updateProductFilter("query", event.target.value)}
            placeholder="Nombre o categoría"
          />
        </label>
        <label>
          <span>Categoría</span>
          <select value={productFilters.category} onChange={(event) => updateProductFilter("category", event.target.value)}>
            <option value="all">Todas</option>
            {productCategories.map((category) => (
              <option key={category.id} value={category.name}>{category.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Estado</span>
          <select value={productFilters.status} onChange={(event) => updateProductFilter("status", event.target.value)}>
            <option value="all">Todos</option>
            <option value="available">Disponibles</option>
            <option value="soldOut">Agotados</option>
            <option value="hidden">Ocultos</option>
          </select>
        </label>
        <label>
          <span>Orden</span>
          <select value={productFilters.order} onChange={(event) => updateProductFilter("order", event.target.value)}>
            <option value="manual">Manual</option>
            <option value="name">Nombre</option>
            <option value="category">Categoría</option>
            <option value="priceAsc">Precio menor</option>
            <option value="priceDesc">Precio mayor</option>
          </select>
        </label>
        <button className="tpv-button tpv-button-secondary" type="button" onClick={resetProductFilters} disabled={!productFiltersActive}>
          Limpiar filtros
        </button>
      </section>

      {productFiltersActive && (
        <p className="tpv-product-filter-note">
          {productCategoryOrderMode
            ? `Ordenando ${filteredProducts.length} productos dentro de ${productFilters.category}.`
            : `Mostrando ${filteredProducts.length} de ${products.length}. Limpia los filtros para ordenar manualmente.`}
        </p>
      )}

      <div className="tpv-product-order-wrap">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragCancel={() => setActiveProductId("")}
          onDragEnd={handleProductDragEnd}
          onDragStart={handleProductDragStart}
        >
          <SortableContext items={productFiltersActive ? filteredProductIds : productIds} strategy={verticalListSortingStrategy}>
            <div className="tpv-product-order-list" ref={productOrderListRef}>
              <div className="tpv-product-order-head" aria-hidden="true">
                <span />
                <span>Producto</span>
                <span>Categoría</span>
                <span>Precio</span>
                <span>Estado</span>
                <span>Acciones</span>
              </div>
              {loading && <div className="tpv-product-order-empty">Cargando productos...</div>}
              {!loading && products.length === 0 && <div className="tpv-product-order-empty">Todavía no hay productos.</div>}
              {!loading && products.length > 0 && filteredProducts.length === 0 && <div className="tpv-product-order-empty">No hay productos con esos filtros.</div>}
              {!loading && filteredProducts.map((product) => (
                <SortableProductRow
                  key={product.id}
                  disabled={productSortingDisabled}
                  product={product}
                  onDelete={removeProduct}
                  onEdit={editProduct}
                  onToggleSoldOut={toggleProductSoldOut}
                  setConfirmModal={setConfirmModal}
                />
              ))}
            </div>
          </SortableContext>
          {typeof document !== "undefined" && createPortal(
            <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
              {activeDraggedProduct ? <ProductDragPreview product={activeDraggedProduct} width={dragOverlayWidth} /> : null}
            </DragOverlay>,
            document.body,
          )}
        </DndContext>
      </div>
    </article>
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
    </div>
  );
}

function SortableMixerItem({ product, supplementCents, onSupplementChange }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id });
  const [supplementDraft, setSupplementDraft] = useState(formatSupplementInput(supplementCents ?? 0));
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  useEffect(() => {
    setSupplementDraft(formatSupplementInput(supplementCents ?? 0));
  }, [supplementCents]);

  function commitSupplement() {
    const nextSupplementCents = parseSupplementCents(supplementDraft);
    setSupplementDraft(formatSupplementInput(nextSupplementCents));
    onSupplementChange(product.id, nextSupplementCents);
  }

  return (
    <div className={isDragging ? "tpv-cubata-sort-item is-dragging" : "tpv-cubata-sort-item"} ref={setNodeRef} style={style}>
      <button
        className="tpv-drag-handle"
        type="button"
        aria-label={`Cambiar orden de ${product.name}`}
        title="Arrastrar para ordenar"
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" size={17} strokeWidth={2.2} />
      </button>
      <strong>{product.name}</strong>
      {onSupplementChange && (
        <label className="tpv-cubata-supplement">
          <span>Suplemento</span>
          <input
            min="0"
            step="0.10"
            type="number"
            value={supplementDraft}
            onChange={(event) => setSupplementDraft(event.target.value)}
            onBlur={commitSupplement}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              event.target.blur();
            }}
            aria-label={`Suplemento de ${product.name}`}
            placeholder="0,00"
          />
        </label>
      )}
    </div>
  );
}

function SortableOrganizeItem({ product }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div className={isDragging ? "tpv-cubata-sort-item is-dragging" : "tpv-cubata-sort-item"} ref={setNodeRef} style={style}>
      <button
        className="tpv-drag-handle"
        type="button"
        aria-label={`Cambiar orden de ${product.name}`}
        title="Arrastrar para ordenar"
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" size={17} strokeWidth={2.2} />
      </button>
      <strong className="tpv-organize-name">{product.name}</strong>
      <span className="tpv-organize-price">{formatPrice(product.price)}</span>
      <span className={product.soldOut ? "tpv-status is-sold-out" : product.active ? "tpv-status is-active" : "tpv-status"}>
        {product.soldOut ? "Agotado" : product.active ? "Activo" : "Oculto"}
      </span>
    </div>
  );
}

function ProductDragPreview({ product, width }) {
  return (
    <div className="tpv-product-order-item tpv-product-order-preview" style={width ? { width } : undefined}>
      <span className="tpv-drag-handle" aria-hidden="true">
        <GripVertical aria-hidden="true" size={17} strokeWidth={2.2} />
      </span>
      <strong className="tpv-product-order-name">{product.name}</strong>
      <span className="tpv-product-order-meta">{product.category}</span>
      <span className="tpv-product-order-price">{formatPrice(product.price)}</span>
      <span className={product.soldOut ? "tpv-status is-sold-out" : product.active ? "tpv-status is-active" : "tpv-status"}>
        {product.soldOut ? "Agotado" : product.active ? "Activo" : "Oculto"}
      </span>
      <div className="tpv-row-actions" aria-hidden="true">
        <span><Ban aria-hidden="true" size={16} strokeWidth={2.2} /></span>
        <span><Pencil aria-hidden="true" size={16} strokeWidth={2.2} /></span>
        <span><Trash2 aria-hidden="true" size={16} strokeWidth={2.2} /></span>
      </div>
    </div>
  );
}

function SortableCategoryItem({ category, disabled = false, itemCount = 0, onEdit, onOpen, onToggleActive, setConfirmModal }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ disabled, id: category.id });
  const isCollection = category.kind === "collection";
  const className = [
    "tpv-category-item",
    isCollection ? "is-collection" : "",
    isDragging ? "is-dragging" : "",
  ].filter(Boolean).join(" ");
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div className={className} ref={setNodeRef} style={style}>
      <button
        className={disabled ? "tpv-drag-handle is-disabled" : "tpv-drag-handle"}
        type="button"
        aria-label={`Cambiar orden de ${category.name}`}
        title="Arrastrar para ordenar"
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" size={17} strokeWidth={2.2} />
      </button>
      <div>
        <strong>{category.name}</strong>
        <span className="tpv-category-kind">
          {isCollection ? `Colección · ${itemCount}` : "Productos"}
        </span>
        <span className={category.active ? "tpv-status is-active" : "tpv-status"}>{category.active ? "Activa" : "Oculta"}</span>
      </div>
      <div className="tpv-row-actions">
        <button
          type="button"
          onClick={() => onOpen(category)}
          aria-label={isCollection
            ? `Elegir los productos de ${category.name}`
            : `Ordenar los productos de ${category.name}`}
          title={isCollection ? "Elegir sus productos" : "Ordenar sus productos"}
        >
          <ArrowRight aria-hidden="true" size={16} strokeWidth={2.2} />
        </button>
        <button type="button" onClick={() => onEdit(category)} aria-label={`Editar ${category.name}`} title="Editar">
          <Pencil aria-hidden="true" size={16} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          onClick={() => setConfirmModal({
            title: category.active ? "Desactivar categoría" : "Activar categoría",
            message: category.active
              ? `Se ocultará ${category.name} de la carta, pero seguirá existiendo internamente.`
              : `Se volverá a mostrar ${category.name} en la carta.`,
            confirmLabel: category.active ? "Desactivar" : "Activar",
            onConfirm: () => onToggleActive(category),
          })}
          aria-label={`${category.active ? "Desactivar" : "Activar"} ${category.name}`}
          title={category.active ? "Desactivar" : "Activar"}
        >
          {category.active ? (
            <Ban aria-hidden="true" size={16} strokeWidth={2.2} />
          ) : (
            <CheckCircle2 aria-hidden="true" size={16} strokeWidth={2.2} />
          )}
        </button>
      </div>
    </div>
  );
}

function SortableProductRow({ disabled = false, product, onDelete, onEdit, onToggleSoldOut, setConfirmModal }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ disabled, id: product.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div className={isDragging ? "tpv-product-order-item is-dragging" : "tpv-product-order-item"} ref={setNodeRef} style={style}>
      <button
        className={disabled ? "tpv-drag-handle is-disabled" : "tpv-drag-handle"}
        type="button"
        aria-label={`Cambiar orden de ${product.name}`}
        title="Arrastrar para ordenar"
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" size={17} strokeWidth={2.2} />
      </button>
      <strong className="tpv-product-order-name">{product.name}</strong>
      <span className="tpv-product-order-meta">{product.category}</span>
      <span className="tpv-product-order-price">{formatPrice(product.price)}</span>
      <span className={product.soldOut ? "tpv-status is-sold-out" : product.active ? "tpv-status is-active" : "tpv-status"}>
        {product.soldOut ? "Agotado" : product.active ? "Activo" : "Oculto"}
      </span>
      <div className="tpv-row-actions">
        <button
          type="button"
          onClick={() => onToggleSoldOut(product)}
          aria-label={`${product.soldOut ? "Marcar disponible" : "Marcar agotado"} ${product.name}`}
          title={product.soldOut ? "Marcar disponible" : "Marcar agotado"}
        >
          {product.soldOut ? (
            <CheckCircle2 aria-hidden="true" size={16} strokeWidth={2.2} />
          ) : (
            <Ban aria-hidden="true" size={16} strokeWidth={2.2} />
          )}
        </button>
        <button
          type="button"
          onClick={() => onEdit(product)}
          aria-label={`Editar ${product.name}`}
          title="Editar"
        >
          <Pencil aria-hidden="true" size={16} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          onClick={() => setConfirmModal({
            title: "Eliminar producto",
            message: `Se eliminará ${product.name}.`,
            confirmLabel: "Eliminar",
            onConfirm: () => onDelete(product),
          })}
          aria-label={`Borrar ${product.name}`}
          title="Borrar"
        >
          <Trash2 aria-hidden="true" size={16} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
