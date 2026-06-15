import { query } from "./db";

let categoriesTableReady = false;

async function ensureCategoriesTable() {
  if (categoriesTableReady) return;

  await query("create extension if not exists pgcrypto");
  await query(`
    create table if not exists tpv_categories (
      id uuid primary key default gen_random_uuid(),
      name text not null unique,
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
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

  categoriesTableReady = true;
}

function normalizeCategory(row) {
  return {
    id: row.id,
    name: row.name,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizePayload(payload) {
  const name = String(payload.name ?? "").trim();
  const active = payload.active ?? true;

  if (!name) throw new Error("El nombre de categoria es obligatorio");

  return {
    name,
    active: Boolean(active),
  };
}

export async function listCategories({ includeInactive = true } = {}) {
  await ensureCategoriesTable();

  const result = await query(
    `
      select id, name, active, created_at, updated_at
      from tpv_categories
      where ($1::boolean = true or active = true)
      order by name asc
    `,
    [includeInactive],
  );

  return result.rows.map(normalizeCategory);
}

export async function getCategoryByName(name) {
  await ensureCategoriesTable();

  const result = await query(
    `
      select id, name, active, created_at, updated_at
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
      insert into tpv_categories (name, active)
      values ($1, $2)
      returning id, name, active, created_at, updated_at
    `,
    [category.name, category.active],
  );

  return normalizeCategory(result.rows[0]);
}

export async function updateCategory(id, payload) {
  await ensureCategoriesTable();
  const category = normalizePayload(payload);
  const currentResult = await query("select name from tpv_categories where id = $1", [id]);
  const currentName = currentResult.rows[0]?.name;
  if (!currentName) return null;

  const result = await query(
    `
      update tpv_categories
      set name = $2,
          active = $3,
          updated_at = now()
      where id = $1
      returning id, name, active, created_at, updated_at
    `,
    [id, category.name, category.active],
  );

  const productTableResult = await query("select to_regclass('public.tpv_products') as table_name");
  if (productTableResult.rows[0]?.table_name && currentName !== category.name) {
    await query(
      `
        update tpv_products
        set category = $2,
            updated_at = now()
        where lower(category) = lower($1)
      `,
      [currentName, category.name],
    );
  }

  return result.rows[0] ? normalizeCategory(result.rows[0]) : null;
}

export async function deleteCategory(id) {
  await ensureCategoriesTable();

  const categoryResult = await query("select name from tpv_categories where id = $1", [id]);
  const categoryName = categoryResult.rows[0]?.name;
  if (!categoryName) return false;

  const productTableResult = await query("select to_regclass('public.tpv_products') as table_name");
  if (productTableResult.rows[0]?.table_name) {
    const usedResult = await query(
      "select count(*)::integer as total from tpv_products where lower(category) = lower($1)",
      [categoryName],
    );
    if (usedResult.rows[0]?.total > 0) {
      throw new Error("No puedes borrar una categoria con productos");
    }
  }

  const result = await query("delete from tpv_categories where id = $1 returning id", [id]);
  return result.rowCount > 0;
}
