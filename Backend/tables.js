import { query } from "./db";

let tablesTableReady = false;

async function ensureTablesTable() {
  if (tablesTableReady) return;

  await query("create extension if not exists pgcrypto");
  await query(`
    create table if not exists tpv_tables (
      id uuid primary key default gen_random_uuid(),
      table_number integer not null unique check (table_number > 0),
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  tablesTableReady = true;
}

function normalizeTable(row) {
  return {
    id: row.id,
    number: row.table_number,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listTables({ includeInactive = true } = {}) {
  await ensureTablesTable();

  const result = await query(
    `
      select id, table_number, active, created_at, updated_at
      from tpv_tables
      where ($1::boolean = true or active = true)
      order by table_number asc
    `,
    [includeInactive],
  );

  return result.rows.map(normalizeTable);
}

export async function createNextTable() {
  await ensureTablesTable();

  const result = await query(`
    insert into tpv_tables (table_number)
    values ((select coalesce(max(table_number), 0) + 1 from tpv_tables))
    returning id, table_number, active, created_at, updated_at
  `);

  return normalizeTable(result.rows[0]);
}

export async function setTableActive(id, active) {
  await ensureTablesTable();

  const result = await query(
    `
      update tpv_tables
      set active = $2,
          updated_at = now()
      where id = $1
      returning id, table_number, active, created_at, updated_at
    `,
    [id, Boolean(active)],
  );

  return result.rows[0] ? normalizeTable(result.rows[0]) : null;
}

export async function deleteTable(id) {
  await ensureTablesTable();

  const result = await query("delete from tpv_tables where id = $1 returning id", [id]);
  return result.rowCount > 0;
}
