import { query } from "./db";
import { ensureProductsTable, getProduct, listProducts } from "./products";

const MIXER_CATEGORIES = new Set(["alcohol", "refresco"]);

let cubataMixersTableReady = false;

async function ensureCubataMixersTable() {
  if (cubataMixersTableReady) return;

  await ensureProductsTable();
  await query(`
    create table if not exists tpv_cubata_mixers (
      alcohol_product_id uuid not null references tpv_products(id) on delete cascade,
      refresco_product_id uuid not null references tpv_products(id) on delete cascade,
      supplement_cents integer not null default 0 check (supplement_cents >= 0),
      sort_order integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      primary key (alcohol_product_id, refresco_product_id)
    )
  `);
  await query(`
    alter table tpv_cubata_mixers
    add column if not exists supplement_cents integer not null default 0
  `);

  cubataMixersTableReady = true;
}

function normalizeCategory(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("es-ES");
}

function normalizeSupplementCents(value) {
  const supplementCents = Number.parseInt(value ?? 0, 10);
  if (!Number.isInteger(supplementCents) || supplementCents < 0) {
    throw new Error("El suplemento no es válido");
  }

  return supplementCents;
}

function normalizeMixerInput(mixer) {
  if (mixer && typeof mixer === "object") {
    return {
      productId: String(mixer.productId ?? mixer.refrescoProductId ?? mixer.id ?? "").trim(),
      supplementCents: normalizeSupplementCents(
        mixer.supplementCents ?? Math.round(Number(mixer.supplement ?? 0) * 100),
      ),
    };
  }

  return {
    productId: String(mixer ?? "").trim(),
    supplementCents: 0,
  };
}

function normalizeConfigRows(rows) {
  const configs = new Map();

  rows.forEach((row) => {
    const alcoholProductId = row.alcohol_product_id;
    if (!configs.has(alcoholProductId)) {
      configs.set(alcoholProductId, {
        alcoholProductId,
        mixerProductIds: [],
        mixers: [],
      });
    }

    const config = configs.get(alcoholProductId);
    config.mixerProductIds.push(row.refresco_product_id);
    config.mixers.push({
      productId: row.refresco_product_id,
      supplement: row.supplement_cents / 100,
      supplementCents: row.supplement_cents,
    });
  });

  return Array.from(configs.values());
}

export async function listCubataMixerConfigs() {
  await ensureCubataMixersTable();

  const result = await query(`
    select
      cm.alcohol_product_id,
      cm.refresco_product_id,
      cm.supplement_cents
    from tpv_cubata_mixers cm
    join tpv_products alcohol on alcohol.id = cm.alcohol_product_id
    join tpv_products refresco on refresco.id = cm.refresco_product_id
    where alcohol.active = true
      and refresco.active = true
    order by cm.alcohol_product_id, cm.sort_order asc
  `);

  return normalizeConfigRows(result.rows);
}

/**
 * Alcoholes y refrescos para el modal de cubata.
 * Se listan aunque su categoría esté oculta en la carta: ocultar "Alcohol"
 * saca la pestaña del menú, pero el cubata se sigue pudiendo montar.
 */
export async function listCubataMixerProducts() {
  const products = await listProducts({ includeInactive: true });

  return products.filter((product) => (
    product.active && MIXER_CATEGORIES.has(normalizeCategory(product.category))
  ));
}

export async function getCubataMixers(alcoholProductId) {
  await ensureCubataMixersTable();

  const result = await query(
    `
      select cm.refresco_product_id, cm.supplement_cents
      from tpv_cubata_mixers cm
      join tpv_products refresco on refresco.id = cm.refresco_product_id
      where cm.alcohol_product_id = $1
        and refresco.active = true
      order by cm.sort_order asc
    `,
    [alcoholProductId],
  );

  return result.rows.map((row) => ({
    productId: row.refresco_product_id,
    supplementCents: row.supplement_cents,
  }));
}

export async function setCubataMixerConfig(alcoholProductId, mixerInput = []) {
  await ensureCubataMixersTable();

  const alcoholProduct = await getProduct(alcoholProductId);
  if (!alcoholProduct || normalizeCategory(alcoholProduct.category) !== "alcohol") {
    throw new Error("El alcohol no es válido");
  }

  const normalizedMixers = [];
  const seenMixerIds = new Set();

  mixerInput.map(normalizeMixerInput).forEach((mixer) => {
    if (!mixer.productId || seenMixerIds.has(mixer.productId)) return;
    seenMixerIds.add(mixer.productId);
    normalizedMixers.push(mixer);
  });

  const mixers = await Promise.all(normalizedMixers.map((mixer) => getProduct(mixer.productId)));
  mixers.forEach((product) => {
    if (!product || normalizeCategory(product.category) !== "refresco") {
      throw new Error("El refresco no es válido");
    }
  });

  await query("delete from tpv_cubata_mixers where alcohol_product_id = $1", [alcoholProductId]);

  if (normalizedMixers.length > 0) {
    await query(
      `
        insert into tpv_cubata_mixers (alcohol_product_id, refresco_product_id, supplement_cents, sort_order)
        select $1::uuid, item.id, item.supplement_cents, item.position::integer
        from unnest($2::uuid[], $3::integer[]) with ordinality as item(id, supplement_cents, position)
      `,
      [
        alcoholProductId,
        normalizedMixers.map((mixer) => mixer.productId),
        normalizedMixers.map((mixer) => mixer.supplementCents),
      ],
    );
  }

  return listCubataMixerConfigs();
}
