import { query } from "./db";

let productsTableReady = false;

async function ensureProductsTable() {
  if (productsTableReady) return;

  await query("create extension if not exists pgcrypto");
  await query(`
    create table if not exists tpv_products (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      category text not null,
      price_cents integer not null check (price_cents >= 0),
      stock integer not null default 0,
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  productsTableReady = true;
}

function normalizeProduct(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    priceCents: row.price_cents,
    price: row.price_cents / 100,
    stock: row.stock,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizePayload(payload) {
  const name = String(payload.name ?? "").trim();
  const category = String(payload.category ?? "").trim();
  const rawPriceCents = payload.priceCents ?? Math.round(Number(payload.price ?? 0) * 100);
  const priceCents = Number.parseInt(rawPriceCents, 10);
  const stock = Number.parseInt(payload.stock ?? 0, 10);
  const active = payload.active ?? true;

  if (!name) throw new Error("El nombre es obligatorio");
  if (!category) throw new Error("La categoria es obligatoria");
  if (!Number.isInteger(priceCents) || priceCents < 0) throw new Error("El precio no es valido");
  if (!Number.isInteger(stock) || stock < 0) throw new Error("El stock no es valido");

  return {
    name,
    category,
    priceCents,
    stock,
    active: Boolean(active),
  };
}

export async function listProducts({ includeInactive = true } = {}) {
  await ensureProductsTable();

  const result = await query(
    `
      select id, name, category, price_cents, stock, active, created_at, updated_at
      from tpv_products
      where ($1::boolean = true or active = true)
      order by created_at desc
    `,
    [includeInactive],
  );

  return result.rows.map(normalizeProduct);
}

export async function getProduct(id) {
  await ensureProductsTable();

  const result = await query(
    `
      select id, name, category, price_cents, stock, active, created_at, updated_at
      from tpv_products
      where id = $1
    `,
    [id],
  );

  return result.rows[0] ? normalizeProduct(result.rows[0]) : null;
}

export async function createProduct(payload) {
  await ensureProductsTable();
  const product = normalizePayload(payload);

  const result = await query(
    `
      insert into tpv_products (name, category, price_cents, stock, active)
      values ($1, $2, $3, $4, $5)
      returning id, name, category, price_cents, stock, active, created_at, updated_at
    `,
    [product.name, product.category, product.priceCents, product.stock, product.active],
  );

  return normalizeProduct(result.rows[0]);
}

export async function updateProduct(id, payload) {
  await ensureProductsTable();
  const product = normalizePayload(payload);

  const result = await query(
    `
      update tpv_products
      set name = $2,
          category = $3,
          price_cents = $4,
          stock = $5,
          active = $6,
          updated_at = now()
      where id = $1
      returning id, name, category, price_cents, stock, active, created_at, updated_at
    `,
    [id, product.name, product.category, product.priceCents, product.stock, product.active],
  );

  return result.rows[0] ? normalizeProduct(result.rows[0]) : null;
}

export async function deleteProduct(id) {
  await ensureProductsTable();

  const result = await query(
    "delete from tpv_products where id = $1 returning id",
    [id],
  );

  return result.rowCount > 0;
}
