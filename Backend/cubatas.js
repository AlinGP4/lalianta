import { query } from "./db";
import { ensureProductsTable, getProduct } from "./products";

let cubataMixersTableReady = false;

async function ensureCubataMixersTable() {
  if (cubataMixersTableReady) return;

  await ensureProductsTable();
  await query(`
    create table if not exists tpv_cubata_mixers (
      alcohol_product_id uuid not null references tpv_products(id) on delete cascade,
      refresco_product_id uuid not null references tpv_products(id) on delete cascade,
      sort_order integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      primary key (alcohol_product_id, refresco_product_id)
    )
  `);

  cubataMixersTableReady = true;
}

function normalizeCategory(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("es-ES");
}

function normalizeConfigRows(rows) {
  const configs = new Map();

  rows.forEach((row) => {
    const alcoholProductId = row.alcohol_product_id;
    if (!configs.has(alcoholProductId)) {
      configs.set(alcoholProductId, {
        alcoholProductId,
        mixerProductIds: [],
      });
    }

    configs.get(alcoholProductId).mixerProductIds.push(row.refresco_product_id);
  });

  return Array.from(configs.values());
}

export async function listCubataMixerConfigs() {
  await ensureCubataMixersTable();

  const result = await query(`
    select
      cm.alcohol_product_id,
      cm.refresco_product_id
    from tpv_cubata_mixers cm
    join tpv_products alcohol on alcohol.id = cm.alcohol_product_id
    join tpv_products refresco on refresco.id = cm.refresco_product_id
    where alcohol.active = true
      and refresco.active = true
    order by cm.alcohol_product_id, cm.sort_order asc
  `);

  return normalizeConfigRows(result.rows);
}

export async function getCubataMixerIds(alcoholProductId) {
  await ensureCubataMixersTable();

  const result = await query(
    `
      select cm.refresco_product_id
      from tpv_cubata_mixers cm
      join tpv_products refresco on refresco.id = cm.refresco_product_id
      where cm.alcohol_product_id = $1
        and refresco.active = true
      order by cm.sort_order asc
    `,
    [alcoholProductId],
  );

  return result.rows.map((row) => row.refresco_product_id);
}

export async function setCubataMixerConfig(alcoholProductId, mixerProductIds = []) {
  await ensureCubataMixersTable();

  const alcoholProduct = await getProduct(alcoholProductId);
  if (!alcoholProduct || normalizeCategory(alcoholProduct.category) !== "alcohol") {
    throw new Error("El alcohol no es válido");
  }

  const normalizedMixerIds = Array.from(new Set(
    mixerProductIds.map((id) => String(id ?? "").trim()).filter(Boolean),
  ));

  const mixers = await Promise.all(normalizedMixerIds.map((id) => getProduct(id)));
  mixers.forEach((product) => {
    if (!product || normalizeCategory(product.category) !== "refresco") {
      throw new Error("El refresco no es válido");
    }
  });

  await query("delete from tpv_cubata_mixers where alcohol_product_id = $1", [alcoholProductId]);

  if (normalizedMixerIds.length > 0) {
    await query(
      `
        insert into tpv_cubata_mixers (alcohol_product_id, refresco_product_id, sort_order)
        select $1::uuid, item.id, item.position::integer
        from unnest($2::uuid[]) with ordinality as item(id, position)
      `,
      [alcoholProductId, normalizedMixerIds],
    );
  }

  return listCubataMixerConfigs();
}
