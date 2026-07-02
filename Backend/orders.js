import { getDb, query } from "./db";
import { getCubataMixerIds } from "./cubatas";
import { ensureProductsTable, getProduct } from "./products";
import { getTableByNumber } from "./tables";

let ordersTableReady = false;

async function ensureOrdersTables() {
  if (ordersTableReady) return;

  await ensureProductsTable();
  await query("create extension if not exists pgcrypto");
  await query(`
    create table if not exists tpv_orders (
      id uuid primary key default gen_random_uuid(),
      order_code text not null unique,
      table_name text,
      table_number integer,
      source text not null default 'waiter',
      status text not null default 'open',
      total_cents integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await query("alter table tpv_orders add column if not exists table_number integer");
  await query("alter table tpv_orders add column if not exists source text not null default 'waiter'");
  await query("alter table tpv_orders add column if not exists kitchen_status text not null default 'pending'");
  await query("alter table tpv_orders add column if not exists bar_status text not null default 'pending'");
  await query(`
    update tpv_orders
    set kitchen_status = 'completed',
        bar_status = 'completed'
    where status in ('delivered', 'paid', 'cancelled')
      and kitchen_status = 'pending'
      and bar_status = 'pending'
  `);
  await query(`
    create table if not exists tpv_order_items (
      id uuid primary key default gen_random_uuid(),
      order_id uuid not null references tpv_orders(id) on delete cascade,
      product_id uuid references tpv_products(id) on delete set null,
      product_name text not null,
      source text not null default 'waiter',
      quantity integer not null check (quantity > 0),
      unit_price_cents integer not null check (unit_price_cents >= 0),
      created_at timestamptz not null default now()
    )
  `);
  await query("alter table tpv_order_items add column if not exists product_id uuid references tpv_products(id) on delete set null");
  await query("alter table tpv_order_items add column if not exists source text not null default 'waiter'");
  ordersTableReady = true;
}

function normalizeOrder(row) {
  return {
    id: row.id,
    orderCode: row.order_code,
    tableName: row.table_name,
    tableNumber: row.table_number,
    source: row.source,
    status: row.status,
    kitchenStatus: row.kitchen_status,
    barStatus: row.bar_status,
    totalCents: row.total_cents,
    total: row.total_cents / 100,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeOrderItem(row) {
  return {
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id,
    productName: row.product_name,
    source: row.source,
    quantity: row.quantity,
    unitPriceCents: row.unit_price_cents,
    unitPrice: row.unit_price_cents / 100,
    createdAt: row.created_at,
  };
}

function normalizeCategory(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("es-ES");
}

function isCubataProduct(product) {
  return normalizeCategory(product.category) === "cubata" || product.name.toLocaleLowerCase("es-ES") === "cubata";
}

function assertMixerProduct(product, expectedCategory, label) {
  if (!product) throw new Error(`${label} no existe`);
  if (!product.active) throw new Error(`${product.name} no está activo`);
  if (product.soldOut) throw new Error(`${product.name} está agotado`);
  if (normalizeCategory(product.category) !== expectedCategory) {
    throw new Error(`${product.name} no está en la categoría ${label}`);
  }
}

async function normalizeItems(items = [], { source = "waiter" } = {}) {
  const normalizedItems = [];

  for (const item of items) {
    const quantity = Number.parseInt(item.quantity ?? item.qty ?? 0, 10);
    const productId = String(item.productId ?? "").trim();
    const alcoholProductId = String(item.alcoholProductId ?? "").trim();
    const refrescoProductId = String(item.refrescoProductId ?? item.mixerProductId ?? "").trim();
    let productName = String(item.productName ?? item.name ?? "").trim();
    let unitPriceCents = Number.parseInt(
      item.unitPriceCents ?? Math.round(Number(item.price ?? 0) * 100),
      10,
    );

    if (productId) {
      const product = await getProduct(productId);
      if (!product) throw new Error("El producto no existe");
      if (!product.active) throw new Error(`${product.name} no está activo`);
      if (product.soldOut) throw new Error(`${product.name} está agotado`);
      productName = product.name;
      unitPriceCents = product.priceCents;

      if (source !== "bar" && isCubataProduct(product)) {
        if (!alcoholProductId || !refrescoProductId) {
          throw new Error("Selecciona alcohol y refresco para el cubata");
        }

        const [alcoholProduct, refrescoProduct] = await Promise.all([
          getProduct(alcoholProductId),
          getProduct(refrescoProductId),
        ]);

        assertMixerProduct(alcoholProduct, "alcohol", "Alcohol");
        assertMixerProduct(refrescoProduct, "refresco", "Refresco");
        const configuredMixerIds = await getCubataMixerIds(alcoholProductId);
        if (configuredMixerIds.length > 0 && !configuredMixerIds.includes(refrescoProductId)) {
          throw new Error(`${refrescoProduct.name} no está configurado para ${alcoholProduct.name}`);
        }
        productName = `${product.name} - ${alcoholProduct.name} + ${refrescoProduct.name}`;
      }
    }

    if (!productName) throw new Error("El producto es obligatorio");
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("La cantidad no es válida");
    if (!Number.isInteger(unitPriceCents) || unitPriceCents < 0) throw new Error("El precio no es válido");

    normalizedItems.push({
      productId: productId || null,
      productName,
      quantity,
      unitPriceCents,
    });
  }

  return normalizedItems;
}

function normalizeSettlementItems(items = []) {
  return items.map((item) => {
    const quantity = Number.parseInt(item.quantity ?? item.qty ?? 0, 10);
    const unitPriceCents = Number.parseInt(
      item.unitPriceCents ?? Math.round(Number(item.unitPrice ?? item.price ?? 0) * 100),
      10,
    );
    const productName = String(item.productName ?? item.name ?? "").trim();
    const source = item.source === "customer" ? "customer" : "waiter";

    if (!productName) throw new Error("El producto es obligatorio");
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("La cantidad no es válida");
    if (!Number.isInteger(unitPriceCents) || unitPriceCents < 0) throw new Error("El precio no es válido");

    return {
      productName,
      quantity,
      source,
      unitPriceCents,
    };
  });
}

async function getOrderItems(orderId) {
  const result = await query(
    `
      select id, order_id, product_id, product_name, source, quantity, unit_price_cents, created_at
      from tpv_order_items
      where order_id = $1
      order by created_at asc
    `,
    [orderId],
  );

  return result.rows.map(normalizeOrderItem);
}

async function getOrderWithItems(orderId) {
  const result = await query(
    `
      select id, order_code, table_name, table_number, source, status, kitchen_status, bar_status, total_cents, created_at, updated_at
      from tpv_orders
      where id = $1
    `,
    [orderId],
  );

  if (!result.rows[0]) return null;

  return {
    ...normalizeOrder(result.rows[0]),
    items: await getOrderItems(orderId),
  };
}

export async function createOrder(payload) {
  await ensureOrdersTables();

  const source = payload.source === "customer"
    ? "customer"
    : payload.source === "bar"
    ? "bar"
    : "waiter";
  const isBarSale = source === "bar";
  const tableNumber = isBarSale ? null : Number.parseInt(payload.tableNumber, 10);
  const items = await normalizeItems(payload.items, { source });

  if (!isBarSale && (!Number.isInteger(tableNumber) || tableNumber <= 0)) throw new Error("La mesa no es válida");
  if (items.length === 0) throw new Error("El pedido no tiene productos");
  const table = isBarSale ? null : await getTableByNumber(tableNumber);
  const tableName = isBarSale ? "Barra" : table?.name ?? `Mesa ${tableNumber}`;

  const orderResult = await query(
    `
      insert into tpv_orders (order_code, table_name, table_number, source, status, total_cents)
      values (
        'PED-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || upper(substr(gen_random_uuid()::text, 1, 6)),
        $1,
        $2,
        $3,
        $4,
        0
      )
      returning id
    `,
    [tableName, tableNumber, source, isBarSale ? "paid" : "pending"],
  );

  const orderId = orderResult.rows[0].id;

  for (const item of items) {
    const updateResult = await query(
      `
        update tpv_order_items
        set quantity = quantity + $4
        where order_id = $1
          and product_name = $2
          and source = $3
          and unit_price_cents = $5
          and (($6::uuid is null and product_id is null) or product_id = $6::uuid)
      `,
      [orderId, item.productName, source, item.quantity, item.unitPriceCents, item.productId],
    );

    if (updateResult.rowCount === 0) {
      await query(
        `
          insert into tpv_order_items (order_id, product_id, product_name, source, quantity, unit_price_cents)
          values ($1, $2, $3, $4, $5, $6)
        `,
        [orderId, item.productId, item.productName, source, item.quantity, item.unitPriceCents],
      );
    }
  }

  await query(
    `
      update tpv_orders
      set total_cents = (
            select coalesce(sum(quantity * unit_price_cents), 0)
            from tpv_order_items
            where order_id = $1
          ),
          updated_at = now()
      where id = $1
    `,
    [orderId],
  );

  return getOrderWithItems(orderId);
}

export async function settleDeliveredItems(payload) {
  await ensureOrdersTables();

  const tableNumber = Number.parseInt(payload.tableNumber, 10);
  const items = normalizeSettlementItems(payload.items);

  if (!Number.isInteger(tableNumber) || tableNumber <= 0) throw new Error("La mesa no es válida");
  if (items.length === 0) throw new Error("No hay líneas para cobrar");
  const table = await getTableByNumber(tableNumber);
  const tableName = table?.name ?? `Mesa ${tableNumber}`;

  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("begin");

    const availableItemsResult = await client.query(
      `
        select
          oi.id,
          oi.order_id,
          oi.product_id,
          oi.product_name,
          oi.source,
          oi.quantity,
          oi.unit_price_cents,
          oi.created_at
        from tpv_order_items oi
        join tpv_orders o on o.id = oi.order_id
        where o.table_number = $1
          and o.status = 'delivered'
        order by o.created_at asc, oi.created_at asc
      `,
      [tableNumber],
    );

    const itemsByKey = new Map();
    availableItemsResult.rows.forEach((row) => {
      const key = `${row.product_name}|${row.source}|${row.unit_price_cents}`;
      const current = itemsByKey.get(key) ?? [];
      current.push({
        id: row.id,
        orderId: row.order_id,
        productName: row.product_name,
        productId: row.product_id,
        source: row.source,
        quantity: row.quantity,
        unitPriceCents: row.unit_price_cents,
      });
      itemsByKey.set(key, current);
    });

    const paidSource = items.every((item) => item.source === items[0].source) ? items[0].source : "mixed";
    const paidOrderResult = await client.query(
      `
        insert into tpv_orders (order_code, table_name, table_number, source, status, total_cents)
        values (
          'PED-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || upper(substr(gen_random_uuid()::text, 1, 6)),
          $1,
          $2,
          $3,
          'paid',
          0
        )
        returning id
      `,
      [tableName, tableNumber, paidSource],
    );
    const paidOrderId = paidOrderResult.rows[0].id;
    const affectedOrderIds = new Set();

    for (const item of items) {
      const key = `${item.productName}|${item.source}|${item.unitPriceCents}`;
      const availableRows = itemsByKey.get(key) ?? [];
      let remaining = item.quantity;

      for (const availableRow of availableRows) {
        if (remaining <= 0) break;
        if (availableRow.quantity <= 0) continue;

        const movedQuantity = Math.min(availableRow.quantity, remaining);

        if (movedQuantity === availableRow.quantity) {
          await client.query("delete from tpv_order_items where id = $1", [availableRow.id]);
        } else {
          await client.query(
            "update tpv_order_items set quantity = quantity - $2 where id = $1",
            [availableRow.id, movedQuantity],
          );
        }

        const paidUpdateResult = await client.query(
          `
            update tpv_order_items
            set quantity = quantity + $4
            where order_id = $1
              and product_name = $2
              and source = $3
              and unit_price_cents = $5
              and (($6::uuid is null and product_id is null) or product_id = $6::uuid)
          `,
          [paidOrderId, item.productName, item.source, movedQuantity, item.unitPriceCents, availableRow.productId],
        );

        if (paidUpdateResult.rowCount === 0) {
          await client.query(
            `
              insert into tpv_order_items (order_id, product_id, product_name, source, quantity, unit_price_cents)
              values ($1, $2, $3, $4, $5, $6)
            `,
            [paidOrderId, availableRow.productId, item.productName, item.source, movedQuantity, item.unitPriceCents],
          );
        }

        availableRow.quantity -= movedQuantity;
        remaining -= movedQuantity;
        affectedOrderIds.add(availableRow.orderId);
      }

      if (remaining > 0) {
        throw new Error(`No hay cantidad suficiente para cobrar ${item.productName}`);
      }
    }

    await client.query(
      `
        update tpv_orders
        set total_cents = (
              select coalesce(sum(quantity * unit_price_cents), 0)
              from tpv_order_items
              where order_id = $1
            ),
            updated_at = now()
        where id = $1
      `,
      [paidOrderId],
    );

    for (const orderId of affectedOrderIds) {
      const totalsResult = await client.query(
        `
          select
            coalesce(sum(quantity * unit_price_cents), 0) as total_cents,
            count(*)::integer as item_count
          from tpv_order_items
          where order_id = $1
        `,
        [orderId],
      );

      const { total_cents: totalCents, item_count: itemCount } = totalsResult.rows[0];
      await client.query(
        `
          update tpv_orders
          set status = $2,
              total_cents = $3,
              updated_at = now()
          where id = $1
        `,
        [orderId, itemCount === 0 ? "paid" : "delivered", Number(totalCents)],
      );
    }

    await client.query("commit");
    return { paidOrderId };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function listOrders({ status, source, tableNumber, includeItems = false } = {}) {
  await ensureOrdersTables();

  const result = await query(
    `
      select id, order_code, table_name, table_number, source, status, kitchen_status, bar_status, total_cents, created_at, updated_at
      from tpv_orders
      where ($1::text is null or status = $1)
        and ($2::text is null or source = $2)
        and ($3::integer is null or table_number = $3)
      order by created_at desc
    `,
    [status || null, source || null, tableNumber ? Number.parseInt(tableNumber, 10) : null],
  );

  const orders = result.rows.map(normalizeOrder);
  if (!includeItems || orders.length === 0) return orders;

  const itemsResult = await query(
    `
      select id, order_id, product_id, product_name, source, quantity, unit_price_cents, created_at
      from tpv_order_items
      where order_id = any($1::uuid[])
      order by created_at asc
    `,
    [orders.map((order) => order.id)],
  );
  const itemsByOrder = new Map();
  itemsResult.rows.forEach((row) => {
    const item = normalizeOrderItem(row);
    const currentItems = itemsByOrder.get(item.orderId) ?? [];
    currentItems.push(item);
    itemsByOrder.set(item.orderId, currentItems);
  });

  return orders.map((order) => ({
    ...order,
    items: itemsByOrder.get(order.id) ?? [],
  }));
}

export async function listPendingOrderNotifications() {
  await ensureOrdersTables();

  const result = await query(`
    select table_number, count(*)::integer as pending_orders
    from tpv_orders
    where status in ('pending', 'preparing')
      and table_number is not null
    group by table_number
    order by table_number asc
  `);

  const tables = result.rows.map((row) => {
    const pendingOrders = Number(row.pending_orders ?? 0);

    return {
      tableNumber: Number(row.table_number),
      hasPendingOrders: pendingOrders > 0,
      pendingOrders,
    };
  });

  return {
    tables,
    totalPendingOrders: tables.reduce((total, table) => total + table.pendingOrders, 0),
    updatedAt: new Date().toISOString(),
  };
}

export async function deleteOrdersByTable(tableNumber) {
  await ensureOrdersTables();

  const normalizedTableNumber = Number.parseInt(tableNumber, 10);
  if (!Number.isInteger(normalizedTableNumber) || normalizedTableNumber <= 0) {
    throw new Error("La mesa no es válida");
  }

  const result = await query(
    "delete from tpv_orders where table_number = $1 returning id",
    [normalizedTableNumber],
  );

  return result.rowCount;
}

export async function deleteOrdersByScope(scope) {
  await ensureOrdersTables();

  if (scope === "pending") {
    const result = await query(
      "delete from tpv_orders where status in ('pending', 'preparing') returning id",
    );
    return result.rowCount;
  }

  if (scope === "today") {
    const result = await query(
      `
        delete from tpv_orders
        where created_at >= date_trunc('day', now())
        returning id
      `,
    );
    return result.rowCount;
  }

  if (scope === "all") {
    const result = await query("delete from tpv_orders returning id");
    return result.rowCount;
  }

  throw new Error("El alcance no es válido");
}

export async function updateOrderStatus(id, status) {
  await ensureOrdersTables();

  const allowedStatuses = ["pending", "preparing", "delivered", "paid", "cancelled", "open"];
  if (!allowedStatuses.includes(status)) throw new Error("El estado no es válido");

  const result = await query(
    `
      update tpv_orders
      set status = $2,
          updated_at = now()
      where id = $1
      returning id, order_code, table_name, table_number, source, status, kitchen_status, bar_status, total_cents, created_at, updated_at
    `,
    [id, status],
  );

  return result.rows[0] ? normalizeOrder(result.rows[0]) : null;
}

export async function updateOrderItems(id, items = []) {
  await ensureOrdersTables();

  if (!Array.isArray(items) || items.length === 0) throw new Error("No hay líneas para editar");

  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("begin");

    const orderResult = await client.query(
      `
        select id, status
        from tpv_orders
        where id = $1
        for update
      `,
      [id],
    );
    const order = orderResult.rows[0];
    if (!order) {
      await client.query("rollback");
      return null;
    }
    if (order.status === "paid" || order.status === "cancelled") {
      throw new Error("Este pedido ya no se puede editar");
    }

    for (const item of items) {
      const itemId = String(item.id ?? "").trim();
      const quantity = Number.parseInt(item.quantity ?? item.qty ?? 0, 10);

      if (!itemId) throw new Error("La línea del pedido no es válida");
      if (!Number.isInteger(quantity) || quantity < 0) throw new Error("La cantidad no es válida");

      if (quantity === 0) {
        await client.query(
          "delete from tpv_order_items where id = $1 and order_id = $2",
          [itemId, id],
        );
      } else {
        const updateResult = await client.query(
          `
            update tpv_order_items
            set quantity = $3
            where id = $1
              and order_id = $2
          `,
          [itemId, id, quantity],
        );

        if (updateResult.rowCount === 0) throw new Error("La línea del pedido no existe");
      }
    }

    const totalsResult = await client.query(
      `
        select
          coalesce(sum(quantity * unit_price_cents), 0) as total_cents,
          count(*)::integer as item_count
        from tpv_order_items
        where order_id = $1
      `,
      [id],
    );
    const { total_cents: totalCents, item_count: itemCount } = totalsResult.rows[0];

    await client.query(
      `
        update tpv_orders
        set total_cents = $2,
            status = case when $3::integer = 0 then 'cancelled' else status end,
            updated_at = now()
        where id = $1
      `,
      [id, Number(totalCents), Number(itemCount)],
    );

    await client.query("commit");
    return getOrderWithItems(id);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateOrderAreaStatus(id, area, status) {
  await ensureOrdersTables();

  const normalizedArea = area === "bar" ? "bar" : area === "kitchen" ? "kitchen" : "";
  const normalizedStatus = status === "completed" ? "completed" : status === "pending" ? "pending" : "";

  if (!normalizedArea) throw new Error("El histórico no es válido");
  if (!normalizedStatus) throw new Error("El estado del histórico no es válido");

  const columnName = normalizedArea === "bar" ? "bar_status" : "kitchen_status";
  const result = await query(
    `
      update tpv_orders
      set ${columnName} = $2,
          status = case
            when $3::text = 'bar'
              and $2::text = 'completed'
              and status in ('pending', 'preparing', 'open')
            then 'delivered'
            else status
          end,
          updated_at = now()
      where id = $1
      returning id, order_code, table_name, table_number, source, status, kitchen_status, bar_status, total_cents, created_at, updated_at
    `,
    [id, normalizedStatus, normalizedArea],
  );

  return result.rows[0] ? normalizeOrder(result.rows[0]) : null;
}
