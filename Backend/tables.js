import { query } from "./db";
import { ensureWaiterCallsTable } from "./waiter-calls";

let tablesTableReady = false;

async function ensureTablesTable() {
  if (tablesTableReady) return;

  await query("create extension if not exists pgcrypto");
  await query(`
    create table if not exists tpv_tables (
      id uuid primary key default gen_random_uuid(),
      table_number integer not null unique check (table_number > 0),
      table_name text,
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await query("alter table tpv_tables add column if not exists table_name text");

  tablesTableReady = true;
}

function normalizeTable(row) {
  const pendingOrders = Number(row.pending_orders ?? 0);
  const openOrders = Number(row.open_orders ?? 0);
  const waiterCalls = Number(row.waiter_calls ?? 0);

  return {
    id: row.id,
    number: row.table_number,
    name: row.table_name || `Mesa ${row.table_number}`,
    active: row.active,
    hasPendingOrders: pendingOrders > 0,
    hasOpenOrders: openOrders > 0,
    hasWaiterCall: waiterCalls > 0,
    pendingOrders,
    openOrders,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isDuplicateTableNumberError(error) {
  return error?.code === "23505" && error?.constraint === "tpv_tables_table_number_key";
}

export async function listTables({ includeInactive = true } = {}) {
  await ensureTablesTable();
  await ensureWaiterCallsTable();

  const ordersTableResult = await query("select to_regclass('public.tpv_orders') as table_name");
  const hasOrdersTable = Boolean(ordersTableResult.rows[0]?.table_name);
  if (hasOrdersTable) {
    await query("alter table tpv_orders add column if not exists table_number integer");
  }

  const result = await query(
    hasOrdersTable
      ? `
        select
          t.id,
          t.table_number,
          t.table_name,
          t.active,
          coalesce(os.pending_orders, 0)::integer as pending_orders,
          coalesce(os.open_orders, 0)::integer as open_orders,
          coalesce(wc.waiter_calls, 0)::integer as waiter_calls,
          t.created_at,
          t.updated_at
        from tpv_tables t
        left join (
          select
            table_number,
            count(*) filter (where status in ('pending', 'preparing'))::integer as pending_orders,
            count(*) filter (where status in ('pending', 'preparing', 'delivered'))::integer as open_orders
          from tpv_orders
          where table_number is not null
          group by table_number
        ) os on os.table_number = t.table_number
        left join (
          select table_number, count(*)::integer as waiter_calls
          from tpv_waiter_calls
          where status = 'pending'
          group by table_number
        ) wc on wc.table_number = t.table_number
        where ($1::boolean = true or t.active = true or coalesce(os.open_orders, 0) > 0 or coalesce(wc.waiter_calls, 0) > 0)
        order by t.table_number asc
      `
      : `
        select
          t.id,
          t.table_number,
          t.table_name,
          t.active,
          0::integer as pending_orders,
          0::integer as open_orders,
          coalesce(wc.waiter_calls, 0)::integer as waiter_calls,
          t.created_at,
          t.updated_at
        from tpv_tables t
        left join (
          select table_number, count(*)::integer as waiter_calls
          from tpv_waiter_calls
          where status = 'pending'
          group by table_number
        ) wc on wc.table_number = t.table_number
        where ($1::boolean = true or t.active = true or coalesce(wc.waiter_calls, 0) > 0)
        order by t.table_number asc
      `,
    [includeInactive],
  );

  return result.rows.map(normalizeTable);
}

export async function createNextTable() {
  await ensureTablesTable();

  let result;
  try {
    result = await query(`
      insert into tpv_tables (table_number)
      values ((select coalesce(max(table_number), 0) + 1 from tpv_tables))
      returning id, table_number, table_name, active, created_at, updated_at
    `);
  } catch (error) {
    if (isDuplicateTableNumberError(error)) {
      throw new Error("Ya existe una mesa con ese número.");
    }

    throw error;
  }

  return normalizeTable(result.rows[0]);
}

export async function createTable(tableNumber) {
  await ensureTablesTable();

  const rawValue = String(tableNumber ?? "").trim();
  if (!rawValue) {
    throw new Error("La mesa no es válida");
  }
  const normalizedTableNumber = Number.parseInt(rawValue, 10);
  const isNumericTable = String(normalizedTableNumber) === rawValue && normalizedTableNumber > 0;
  const customTableName = isNumericTable ? null : rawValue;

  let result;
  try {
    result = isNumericTable
      ? await query(
        `
          insert into tpv_tables (table_number)
          values ($1)
          returning id, table_number, table_name, active, created_at, updated_at
        `,
        [normalizedTableNumber],
      )
      : await query(
        `
          insert into tpv_tables (table_number, table_name)
          values ((select coalesce(max(table_number), 0) + 1 from tpv_tables), $1)
          returning id, table_number, table_name, active, created_at, updated_at
        `,
        [customTableName],
      );
  } catch (error) {
    if (isDuplicateTableNumberError(error)) {
      throw new Error("Ya existe una mesa con ese número.");
    }

    throw error;
  }

  return normalizeTable(result.rows[0]);
}

export async function getTableByNumber(tableNumber) {
  await ensureTablesTable();

  const normalizedTableNumber = Number.parseInt(tableNumber, 10);
  if (!Number.isInteger(normalizedTableNumber) || normalizedTableNumber <= 0) return null;

  const result = await query(
    `
      select id, table_number, table_name, active, created_at, updated_at
      from tpv_tables
      where table_number = $1
    `,
    [normalizedTableNumber],
  );

  return result.rows[0] ? normalizeTable({ ...result.rows[0], pending_orders: 0 }) : null;
}

export async function setTableActive(id, active) {
  await ensureTablesTable();

  const result = await query(
    `
      update tpv_tables
      set active = $2,
          updated_at = now()
      where id = $1
      returning id, table_number, table_name, active, created_at, updated_at
    `,
    [id, Boolean(active)],
  );

  return result.rows[0] ? normalizeTable(result.rows[0]) : null;
}

export async function setAllTablesActive(active) {
  await ensureTablesTable();

  const result = await query(
    `
      update tpv_tables
      set active = $1,
          updated_at = now()
      where active <> $1
      returning id, table_number, table_name, active, created_at, updated_at
    `,
    [Boolean(active)],
  );

  return result.rows.map(normalizeTable);
}

export async function deleteTable(id) {
  await ensureTablesTable();

  const result = await query("delete from tpv_tables where id = $1 returning id", [id]);
  return result.rowCount > 0;
}
