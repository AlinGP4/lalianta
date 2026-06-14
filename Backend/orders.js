import { getDb, query } from "./db";

let ordersTableReady = false;

async function ensureOrdersTables() {
  if (ordersTableReady) return;

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
    productName: row.product_name,
    source: row.source,
    quantity: row.quantity,
    unitPriceCents: row.unit_price_cents,
    unitPrice: row.unit_price_cents / 100,
    createdAt: row.created_at,
  };
}

function normalizeItems(items = []) {
  return items.map((item) => {
    const quantity = Number.parseInt(item.quantity ?? item.qty ?? 0, 10);
    const unitPriceCents = Number.parseInt(
      item.unitPriceCents ?? Math.round(Number(item.price ?? 0) * 100),
      10,
    );
    const productName = String(item.productName ?? item.name ?? "").trim();

    if (!productName) throw new Error("El producto es obligatorio");
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("La cantidad no es valida");
    if (!Number.isInteger(unitPriceCents) || unitPriceCents < 0) throw new Error("El precio no es valido");

    return {
      productName,
      quantity,
      unitPriceCents,
    };
  });
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
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("La cantidad no es valida");
    if (!Number.isInteger(unitPriceCents) || unitPriceCents < 0) throw new Error("El precio no es valido");

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
      select id, order_id, product_name, source, quantity, unit_price_cents, created_at
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
      select id, order_code, table_name, table_number, source, status, total_cents, created_at, updated_at
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

  const tableNumber = Number.parseInt(payload.tableNumber, 10);
  const source = payload.source === "customer" ? "customer" : "waiter";
  const items = normalizeItems(payload.items);

  if (!Number.isInteger(tableNumber) || tableNumber <= 0) throw new Error("La mesa no es valida");
  if (items.length === 0) throw new Error("El pedido no tiene productos");

  const orderResult = await query(
    `
      insert into tpv_orders (order_code, table_name, table_number, source, status, total_cents)
      values (
        'PED-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || upper(substr(gen_random_uuid()::text, 1, 6)),
        $1,
        $2,
        $3,
        'pending',
        0
      )
      returning id
    `,
    [`Mesa ${tableNumber}`, tableNumber, source],
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
      `,
      [orderId, item.productName, source, item.quantity, item.unitPriceCents],
    );

    if (updateResult.rowCount === 0) {
      await query(
        `
          insert into tpv_order_items (order_id, product_name, source, quantity, unit_price_cents)
          values ($1, $2, $3, $4, $5)
        `,
        [orderId, item.productName, source, item.quantity, item.unitPriceCents],
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

  if (!Number.isInteger(tableNumber) || tableNumber <= 0) throw new Error("La mesa no es valida");
  if (items.length === 0) throw new Error("No hay lineas para cobrar");

  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("begin");

    const availableItemsResult = await client.query(
      `
        select
          oi.id,
          oi.order_id,
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
      [`Mesa ${tableNumber}`, tableNumber, paidSource],
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
          `,
          [paidOrderId, item.productName, item.source, movedQuantity, item.unitPriceCents],
        );

        if (paidUpdateResult.rowCount === 0) {
          await client.query(
            `
              insert into tpv_order_items (order_id, product_name, source, quantity, unit_price_cents)
              values ($1, $2, $3, $4, $5)
            `,
            [paidOrderId, item.productName, item.source, movedQuantity, item.unitPriceCents],
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
      select id, order_code, table_name, table_number, source, status, total_cents, created_at, updated_at
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
      select id, order_id, product_name, source, quantity, unit_price_cents, created_at
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

export async function updateOrderStatus(id, status) {
  await ensureOrdersTables();

  const allowedStatuses = ["pending", "preparing", "delivered", "paid", "cancelled", "open"];
  if (!allowedStatuses.includes(status)) throw new Error("El estado no es valido");

  const result = await query(
    `
      update tpv_orders
      set status = $2,
          updated_at = now()
      where id = $1
      returning id, order_code, table_name, table_number, source, status, total_cents, created_at, updated_at
    `,
    [id, status],
  );

  return result.rows[0] ? normalizeOrder(result.rows[0]) : null;
}
