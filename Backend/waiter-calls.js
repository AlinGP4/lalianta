import { query } from "./db";

let waiterCallsTableReady = false;

export async function ensureWaiterCallsTable() {
  if (waiterCallsTableReady) return;

  await query("create extension if not exists pgcrypto");
  await query(`
    create table if not exists tpv_waiter_calls (
      id uuid primary key default gen_random_uuid(),
      table_number integer not null,
      status text not null default 'pending' check (status in ('pending', 'resolved')),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await query("create index if not exists tpv_waiter_calls_status_table_idx on tpv_waiter_calls (status, table_number)");

  waiterCallsTableReady = true;
}

function normalizeWaiterCall(row) {
  return {
    id: row.id,
    tableNumber: Number(row.table_number),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function requestWaiterCall({ tableNumber }) {
  await ensureWaiterCallsTable();

  const normalizedTableNumber = Number.parseInt(tableNumber, 10);
  if (!Number.isInteger(normalizedTableNumber) || normalizedTableNumber <= 0) throw new Error("La mesa no es válida");

  const updateResult = await query(
    `
      update tpv_waiter_calls
      set updated_at = now()
      where table_number = $1
        and status = 'pending'
      returning id, table_number, status, created_at, updated_at
    `,
    [normalizedTableNumber],
  );

  if (updateResult.rows[0]) return normalizeWaiterCall(updateResult.rows[0]);

  const insertResult = await query(
    `
      insert into tpv_waiter_calls (table_number)
      values ($1)
      returning id, table_number, status, created_at, updated_at
    `,
    [normalizedTableNumber],
  );

  return normalizeWaiterCall(insertResult.rows[0]);
}

export async function listPendingWaiterCalls() {
  await ensureWaiterCallsTable();

  const result = await query(`
    select id, table_number, status, created_at, updated_at
    from tpv_waiter_calls
    where status = 'pending'
    order by updated_at desc
  `);

  return result.rows.map(normalizeWaiterCall);
}

export async function resolveWaiterCallsByTable(tableNumber) {
  await ensureWaiterCallsTable();

  const normalizedTableNumber = Number.parseInt(tableNumber, 10);
  if (!Number.isInteger(normalizedTableNumber) || normalizedTableNumber <= 0) throw new Error("La mesa no es válida");

  const result = await query(
    `
      update tpv_waiter_calls
      set status = 'resolved',
          updated_at = now()
      where table_number = $1
        and status = 'pending'
      returning id
    `,
    [normalizedTableNumber],
  );

  return result.rowCount;
}
