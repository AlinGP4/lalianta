export const categories = ["Todo", "Vinos", "Cervezas", "Copas", "Sin alcohol", "Comida"];

export const products = [
  { id: "vino-rioja", name: "Tinto Rioja", category: "Vinos", price: 3.8, active: true },
  { id: "vermut", name: "Vermut casa", category: "Vinos", price: 3.2, active: true },
  { id: "estrella", name: "Cerveza tubo", category: "Cervezas", price: 2.4, active: true },
  { id: "ipa", name: "IPA artesana", category: "Cervezas", price: 4.5, active: true },
  { id: "gin-tonic", name: "Gin tonic", category: "Copas", price: 7.5, active: true },
  { id: "ron-cola", name: "Ron cola", category: "Copas", price: 6.8, active: true },
  { id: "agua", name: "Agua", category: "Sin alcohol", price: 1.6, active: true },
  { id: "coca-cola", name: "Coca-Cola", category: "Sin alcohol", price: 2.2, active: true },
  { id: "bravas", name: "Bravas", category: "Comida", price: 5.5, active: true },
  { id: "tabla-queso", name: "Tabla queso", category: "Comida", price: 12, active: true },
];

export const openOrders = [
  { id: "M03", table: "Mesa 3", items: 5, total: 28.4, status: "En curso", time: "12 min" },
  { id: "B01", table: "Barra 1", items: 2, total: 8.9, status: "Pendiente", time: "4 min" },
  { id: "T07", table: "Terraza 7", items: 7, total: 41.2, status: "Cocina", time: "18 min" },
  { id: "M09", table: "Mesa 9", items: 3, total: 16.5, status: "En curso", time: "7 min" },
];

export const currentTicket = [
  { id: "estrella", name: "Cerveza tubo", qty: 2, price: 2.4 },
  { id: "vermut", name: "Vermut casa", qty: 1, price: 3.2 },
  { id: "bravas", name: "Bravas", qty: 1, price: 5.5 },
];

export function formatPrice(value) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}
