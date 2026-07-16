import { query } from "./db";

export const CATEGORY_KIND_PRODUCT = "product";
export const CATEGORY_KIND_COLLECTION = "collection";

const CATEGORY_KINDS = [CATEGORY_KIND_PRODUCT, CATEGORY_KIND_COLLECTION];

let categoriesTableReady = false;

export async function ensureCategoriesTable() {
  if (categoriesTableReady) return;

  await query("create extension if not exists pgcrypto");
  await query(`
    create table if not exists tpv_categories (
      id uuid primary key default gen_random_uuid(),
      name text not null unique,
      kind text not null default 'product',
      sort_order integer not null default 0,
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await query("alter table tpv_categories add column if not exists sort_order integer not null default 0");
  await query("alter table tpv_categories add column if not exists kind text not null default 'product'");
  await query(`
    do $$
    begin
      alter table tpv_categories
        add constraint tpv_categories_kind_check check (kind in ('product', 'collection'));
    exception
      when duplicate_object then null;
    end $$;
  `);
  await query(`
    insert into tpv_categories (name)
    values ('Cubata'), ('Alcohol'), ('Refresco')
    on conflict (name) do nothing
  `);
  await query(`
    do $$
    begin
      if to_regclass('public.tpv_products') is not null then
        insert into tpv_categories (name)
        select distinct category
        from tpv_products
        where category is not null and trim(category) <> ''
        on conflict (name) do nothing;
      end if;
    end $$;
  `);
  await query(`
    with ranked as (
      select id, row_number() over (order by name asc)::integer as next_order
      from tpv_categories
      where sort_order = 0
    )
    update tpv_categories c
    set sort_order = ranked.next_order
    from ranked
    where c.id = ranked.id
  `);

  categoriesTableReady = true;
}

function normalizeCategory(row) {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    sortOrder: row.sort_order,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizePayload(payload) {
  const name = String(payload.name ?? "").trim();
  const kind = String(payload.kind ?? CATEGORY_KIND_PRODUCT).trim();
  const active = payload.active ?? true;

  if (!name) throw new Error("El nombre de categoría es obligatorio");
  if (!CATEGORY_KINDS.includes(kind)) throw new Error("El tipo de categoría no es válido");

  return {
    name,
    kind,
    active: Boolean(active),
  };
}

async function countCollectionItems(categoryId) {
  const tableResult = await query("select to_regclass('public.tpv_collection_products') as table_name");
  if (!tableResult.rows[0]?.table_name) return 0;

  const result = await query(
    "select count(*)::integer as total from tpv_collection_products where category_id = $1",
    [categoryId],
  );

  return result.rows[0]?.total ?? 0;
}

async function countProductsInCategory(categoryName) {
  const productTableResult = await query("select to_regclass('public.tpv_products') as table_name");
  if (!productTableResult.rows[0]?.table_name) return 0;

  const result = await query(
    "select count(*)::integer as total from tpv_products where lower(category) = lower($1)",
    [categoryName],
  );

  return result.rows[0]?.total ?? 0;
}

export async function listCategories({ includeInactive = true } = {}) {
  await ensureCategoriesTable();

  const result = await query(
    `
      select id, name, kind, sort_order, active, created_at, updated_at
      from tpv_categories
      where ($1::boolean = true or active = true)
      order by sort_order asc, name asc
    `,
    [includeInactive],
  );

  return result.rows.map(normalizeCategory);
}

export async function getCategoryByName(name) {
  await ensureCategoriesTable();

  const result = await query(
    `
      select id, name, kind, sort_order, active, created_at, updated_at
      from tpv_categories
      where lower(name) = lower($1)
    `,
    [String(name ?? "").trim()],
  );

  return result.rows[0] ? normalizeCategory(result.rows[0]) : null;
}

export async function createCategory(payload) {
  await ensureCategoriesTable();
  const category = normalizePayload(payload);

  const result = await query(
    `
      insert into tpv_categories (name, kind, sort_order, active)
      values ($1, $2, (select coalesce(max(sort_order), 0) + 1 from tpv_categories), $3)
      returning id, name, kind, sort_order, active, created_at, updated_at
    `,
    [category.name, category.kind, category.active],
  );

  return normalizeCategory(result.rows[0]);
}

export async function updateCategory(id, payload) {
  await ensureCategoriesTable();
  const category = normalizePayload(payload);
  const currentResult = await query("select name, kind from tpv_categories where id = $1", [id]);
  const current = currentResult.rows[0];
  if (!current) return null;

  if (current.kind !== category.kind) {
    if (category.kind === CATEGORY_KIND_COLLECTION && await countProductsInCategory(current.name) > 0) {
      throw new Error("No puedes convertir en colección una categoría con productos propios");
    }
    if (category.kind === CATEGORY_KIND_PRODUCT && await countCollectionItems(id) > 0) {
      throw new Error("Vacía la colección antes de convertirla en categoría de productos");
    }
  }

  const result = await query(
    `
      update tpv_categories
      set name = $2,
          kind = $3,
          active = $4,
          updated_at = now()
      where id = $1
      returning id, name, kind, sort_order, active, created_at, updated_at
    `,
    [id, category.name, category.kind, category.active],
  );

  const productTableResult = await query("select to_regclass('public.tpv_products') as table_name");
  if (productTableResult.rows[0]?.table_name && current.name !== category.name) {
    await query(
      `
        update tpv_products
        set category = $2,
            updated_at = now()
        where lower(category) = lower($1)
      `,
      [current.name, category.name],
    );
  }

  return result.rows[0] ? normalizeCategory(result.rows[0]) : null;
}

export async function reorderCategories(categoryIds = []) {
  await ensureCategoriesTable();

  const normalizedIds = categoryIds.map((id) => String(id ?? "").trim()).filter(Boolean);
  if (normalizedIds.length === 0) throw new Error("El orden de categorías no es válido");

  await query(
    `
      with ordered as (
        select id, position::integer as sort_order
        from unnest($1::uuid[]) with ordinality as item(id, position)
      )
      update tpv_categories c
      set sort_order = ordered.sort_order,
          updated_at = now()
      from ordered
      where c.id = ordered.id
    `,
    [normalizedIds],
  );

  return listCategories();
}

export async function deleteCategory(id) {
  await ensureCategoriesTable();

  const categoryResult = await query("select name from tpv_categories where id = $1", [id]);
  const categoryName = categoryResult.rows[0]?.name;
  if (!categoryName) return false;

  if (await countProductsInCategory(categoryName) > 0) {
    throw new Error("No puedes borrar una categoría con productos");
  }

  const result = await query("delete from tpv_categories where id = $1 returning id", [id]);
  return result.rowCount > 0;
}
