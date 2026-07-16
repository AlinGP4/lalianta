import { CATEGORY_KIND_COLLECTION, ensureCategoriesTable } from "./categories";
import { query } from "./db";
import { ensureProductsTable } from "./products";

let collectionProductsTableReady = false;

async function ensureCollectionProductsTable() {
  if (collectionProductsTableReady) return;

  await ensureCategoriesTable();
  await ensureProductsTable();
  await query(`
    create table if not exists tpv_collection_products (
      category_id uuid not null references tpv_categories(id) on delete cascade,
      product_id uuid not null references tpv_products(id) on delete cascade,
      sort_order integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      primary key (category_id, product_id)
    )
  `);

  collectionProductsTableReady = true;
}

function normalizeCollectionRows(rows) {
  const collections = new Map();

  rows.forEach((row) => {
    const categoryId = row.category_id;
    if (!collections.has(categoryId)) {
      collections.set(categoryId, { categoryId, productIds: [] });
    }

    collections.get(categoryId).productIds.push(row.product_id);
  });

  return Array.from(collections.values());
}

export async function listCollections() {
  await ensureCollectionProductsTable();

  const result = await query(`
    select cp.category_id, cp.product_id
    from tpv_collection_products cp
    join tpv_categories c on c.id = cp.category_id
    join tpv_products p on p.id = cp.product_id
    where c.kind = 'collection'
    order by cp.category_id, cp.sort_order asc
  `);

  return normalizeCollectionRows(result.rows);
}

export async function setCollectionProducts(categoryId, productIds = []) {
  await ensureCollectionProductsTable();

  const normalizedCategoryId = String(categoryId ?? "").trim();
  if (!normalizedCategoryId) throw new Error("La colección no es válida");

  const categoryResult = await query(
    "select kind from tpv_categories where id = $1",
    [normalizedCategoryId],
  );
  const categoryKind = categoryResult.rows[0]?.kind;
  if (!categoryKind) throw new Error("La colección no existe");
  if (categoryKind !== CATEGORY_KIND_COLLECTION) {
    throw new Error("Solo puedes añadir productos sueltos a una colección");
  }

  const normalizedProductIds = Array.from(new Set(
    productIds.map((id) => String(id ?? "").trim()).filter(Boolean),
  ));

  if (normalizedProductIds.length > 0) {
    const foundResult = await query(
      "select count(*)::integer as total from tpv_products where id = any($1::uuid[])",
      [normalizedProductIds],
    );
    if (foundResult.rows[0]?.total !== normalizedProductIds.length) {
      throw new Error("Alguno de los productos no existe");
    }
  }

  await query("delete from tpv_collection_products where category_id = $1", [normalizedCategoryId]);

  if (normalizedProductIds.length > 0) {
    await query(
      `
        insert into tpv_collection_products (category_id, product_id, sort_order)
        select $1::uuid, item.id, item.position::integer
        from unnest($2::uuid[]) with ordinality as item(id, position)
      `,
      [normalizedCategoryId, normalizedProductIds],
    );
  }

  return listCollections();
}
