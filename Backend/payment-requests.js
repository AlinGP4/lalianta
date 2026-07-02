import { query } from "./db";

let paymentRequestsTableReady = false;

async function ensurePaymentRequestsTable() {
  if (paymentRequestsTableReady) return;

  await query("create extension if not exists pgcrypto");
  await query(`
    create table if not exists tpv_payment_requests (
      id uuid primary key default gen_random_uuid(),
      table_number integer not null,
      payment_method text not null check (payment_method in ('cash', 'card')),
      scope text not null default 'all' check (scope in ('all', 'partial')),
      total_cents integer not null default 0,
      status text not null default 'pending' check (status in ('pending', 'resolved')),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await query("create index if not exists tpv_payment_requests_status_table_idx on tpv_payment_requests (status, table_number)");

  paymentRequestsTableReady = true;
}

function normalizePaymentRequest(row) {
  return {
    id: row.id,
    tableNumber: Number(row.table_number),
    paymentMethod: row.payment_method,
    scope: row.scope,
    totalCents: Number(row.total_cents ?? 0),
    total: Number(row.total_cents ?? 0) / 100,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function requestTablePayment({ tableNumber, paymentMethod, scope = "all", totalCents = 0 }) {
  await ensurePaymentRequestsTable();

  const normalizedTableNumber = Number.parseInt(tableNumber, 10);
  const normalizedMethod = paymentMethod === "card" ? "card" : paymentMethod === "cash" ? "cash" : "";
  const normalizedScope = scope === "partial" ? "partial" : "all";
  const normalizedTotalCents = Number.parseInt(totalCents, 10);

  if (!Number.isInteger(normalizedTableNumber) || normalizedTableNumber <= 0) throw new Error("La mesa no es válida");
  if (!normalizedMethod) throw new Error("El método de pago no es válido");

  const updateResult = await query(
    `
      update tpv_payment_requests
      set payment_method = $2,
          scope = $3,
          total_cents = $4,
          updated_at = now()
      where table_number = $1
        and status = 'pending'
      returning id, table_number, payment_method, scope, total_cents, status, created_at, updated_at
    `,
    [
      normalizedTableNumber,
      normalizedMethod,
      normalizedScope,
      Number.isInteger(normalizedTotalCents) && normalizedTotalCents > 0 ? normalizedTotalCents : 0,
    ],
  );

  if (updateResult.rows[0]) return normalizePaymentRequest(updateResult.rows[0]);

  const insertResult = await query(
    `
      insert into tpv_payment_requests (table_number, payment_method, scope, total_cents)
      values ($1, $2, $3, $4)
      returning id, table_number, payment_method, scope, total_cents, status, created_at, updated_at
    `,
    [
      normalizedTableNumber,
      normalizedMethod,
      normalizedScope,
      Number.isInteger(normalizedTotalCents) && normalizedTotalCents > 0 ? normalizedTotalCents : 0,
    ],
  );

  return normalizePaymentRequest(insertResult.rows[0]);
}

export async function listPendingPaymentRequests() {
  await ensurePaymentRequestsTable();

  let result;
  try {
    result = await query(`
      select
        pr.id,
        pr.table_number,
        pr.payment_method,
        pr.scope,
        coalesce(open_orders.total_cents, pr.total_cents, 0)::integer as total_cents,
        pr.status,
        pr.created_at,
        pr.updated_at
      from tpv_payment_requests pr
      join lateral (
        select coalesce(sum(total_cents), 0)::integer as total_cents
        from tpv_orders
        where table_number = pr.table_number
          and status in ('pending', 'preparing', 'delivered')
      ) open_orders on open_orders.total_cents > 0
      where pr.status = 'pending'
      order by pr.updated_at desc
    `);
  } catch (error) {
    if (error.code === "42P01") return [];
    throw error;
  }

  return result.rows.map(normalizePaymentRequest);
}

export async function resolvePaymentRequestsByTable(tableNumber) {
  await ensurePaymentRequestsTable();

  const normalizedTableNumber = Number.parseInt(tableNumber, 10);
  if (!Number.isInteger(normalizedTableNumber) || normalizedTableNumber <= 0) throw new Error("La mesa no es válida");

  const result = await query(
    `
      update tpv_payment_requests
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
