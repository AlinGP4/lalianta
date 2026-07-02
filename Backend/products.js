import { getCategoryByName } from "./categories";
import { query } from "./db";

let productsTableReady = false;

export async function ensureProductsTable() {
  if (productsTableReady) return;

  await query("create extension if not exists pgcrypto");
  await query(`
    create table if not exists tpv_products (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      category text not null,
      price_cents integer not null check (price_cents >= 0),
      sort_order integer not null default 0,
      sold_out boolean not null default false,
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await query("alter table tpv_products add column if not exists sort_order integer not null default 0");
  await query("alter table tpv_products add column if not exists sold_out boolean not null default false");
  await query(`
    with ranked as (
      select id, row_number() over (order by created_at desc)::integer as next_order
      from tpv_products
      where sort_order = 0
    )
    update tpv_products p
    set sort_order = ranked.next_order
    from ranked
    where p.id = ranked.id
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
    sortOrder: row.sort_order,
    soldOut: row.sold_out,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function normalizePayload(payload) {
  const name = String(payload.name ?? "").trim();
  const category = String(payload.category ?? "").trim();
  const rawPriceCents = payload.priceCents ?? Math.round(Number(payload.price ?? 0) * 100);
  const priceCents = Number.parseInt(rawPriceCents, 10);
  const soldOut = payload.soldOut ?? payload.sold_out ?? false;
  const active = payload.active ?? true;

  if (!name) throw new Error("El nombre es obligatorio");
  if (!category) throw new Error("La categoría es obligatoria");
  const savedCategory = await getCategoryByName(category);
  if (!savedCategory) throw new Error("La categoría no existe");
  if (!savedCategory.active) throw new Error("La categoría está oculta");
  if (!Number.isInteger(priceCents) || priceCents < 0) throw new Error("El precio no es válido");

  return {
    name,
    category: savedCategory.name,
    priceCents,
    soldOut: Boolean(soldOut),
    active: Boolean(active),
  };
}

export async function listProducts({ includeInactive = true } = {}) {
  await ensureProductsTable();

  const categoriesTableResult = await query("select to_regclass('public.tpv_categories') as table_name");
  const hasCategoriesTable = Boolean(categoriesTableResult.rows[0]?.table_name);
  const result = await query(
    hasCategoriesTable
      ? `
        select p.id, p.name, p.category, p.price_cents, p.sort_order, p.sold_out, p.active, p.created_at, p.updated_at
        from tpv_products p
        left join tpv_categories c on lower(c.name) = lower(p.category)
        where ($1::boolean = true or (p.active = true and coalesce(c.active, true) = true))
        order by
          coalesce(c.sort_order, 999999) asc,
          p.sort_order asc,
          p.created_at desc
      `
      : `
        select id, name, category, price_cents, sort_order, sold_out, active, created_at, updated_at
        from tpv_products
        where ($1::boolean = true or active = true)
        order by sort_order asc, created_at desc
      `,
    [includeInactive],
  );

  return result.rows.map(normalizeProduct);
}

export async function getProduct(id) {
  await ensureProductsTable();

  const result = await query(
    `
      select id, name, category, price_cents, sort_order, sold_out, active, created_at, updated_at
      from tpv_products
      where id = $1
    `,
    [id],
  );

  return result.rows[0] ? normalizeProduct(result.rows[0]) : null;
}

export async function createProduct(payload) {
  await ensureProductsTable();
  const product = await normalizePayload(payload);

  const result = await query(
    `
      insert into tpv_products (name, category, price_cents, sort_order, sold_out, active)
      values ($1, $2, $3, (select coalesce(max(sort_order), 0) + 1 from tpv_products), $4, $5)
      returning id, name, category, price_cents, sort_order, sold_out, active, created_at, updated_at
    `,
    [product.name, product.category, product.priceCents, product.soldOut, product.active],
  );

  return normalizeProduct(result.rows[0]);
}

export async function updateProduct(id, payload) {
  await ensureProductsTable();
  const product = await normalizePayload(payload);

  const result = await query(
    `
      update tpv_products
      set name = $2,
          category = $3,
          price_cents = $4,
          sold_out = $5,
          active = $6,
          updated_at = now()
      where id = $1
      returning id, name, category, price_cents, sort_order, sold_out, active, created_at, updated_at
    `,
    [id, product.name, product.category, product.priceCents, product.soldOut, product.active],
  );

  return result.rows[0] ? normalizeProduct(result.rows[0]) : null;
}

export async function setProductSoldOut(id, soldOut) {
  await ensureProductsTable();

  const result = await query(
    `
      update tpv_products
      set sold_out = $2,
          updated_at = now()
      where id = $1
      returning id, name, category, price_cents, sort_order, sold_out, active, created_at, updated_at
    `,
    [id, Boolean(soldOut)],
  );

  return result.rows[0] ? normalizeProduct(result.rows[0]) : null;
}

export async function reorderProducts(productIds = []) {
  await ensureProductsTable();

  const normalizedIds = productIds.map((id) => String(id ?? "").trim()).filter(Boolean);
  if (normalizedIds.length === 0) throw new Error("El orden de productos no es válido");

  await query(
    `
      with ordered as (
        select id, position::integer as sort_order
        from unnest($1::uuid[]) with ordinality as item(id, position)
      )
      update tpv_products p
      set sort_order = ordered.sort_order,
          updated_at = now()
      from ordered
      where p.id = ordered.id
    `,
    [normalizedIds],
  );

  return listProducts();
}

export async function deleteProduct(id) {
  await ensureProductsTable();

  const result = await query(
    "delete from tpv_products where id = $1 returning id",
    [id],
  );

  return result.rowCount > 0;
}
