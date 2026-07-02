import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createAuthToken, verifyAuthToken } from "./auth-token";
import { query } from "./db";

let usersTableReady = false;

function normalizeUser(row) {
  const role = normalizeRole(row.role);

  return {
    id: row.id,
    name: row.name,
    role,
    historyArea: getHistoryAreaForRole(role, row.history_area),
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, key] = String(storedHash || "").split(":");
  if (!salt || !key) return false;

  const calculated = scryptSync(password, salt, 64);
  const stored = Buffer.from(key, "hex");
  if (stored.length !== calculated.length) return false;
  return timingSafeEqual(stored, calculated);
}

function normalizeHistoryArea(value) {
  return value === "kitchen" || value === "bar" ? value : null;
}

function normalizeRole(value) {
  if (value === "admin" || value === "barra" || value === "cocina" || value === "camarero") return value;
  return "barra";
}

function getHistoryAreaForRole(role, fallbackArea = null) {
  if (role === "cocina") return "kitchen";
  if (role === "barra") return "bar";
  return normalizeHistoryArea(fallbackArea);
}

function getInternalEmail(name) {
  return `${String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "") || "usuario"}@tpv.local`;
}

async function ensureUsersTable() {
  if (usersTableReady) return;

  await query("create extension if not exists pgcrypto");
  await query(`
    create table if not exists tpv_users (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      email text not null unique,
      password_hash text not null,
      role text not null check (role in ('admin', 'barra', 'cocina', 'camarero')),
      history_area text constraint tpv_users_history_area_check check (history_area in ('kitchen', 'bar')),
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await query(`
    do $$
    begin
      alter table tpv_users drop constraint if exists tpv_users_role_check;
      update tpv_users set role = 'barra' where role = 'worker';

      begin
        alter table tpv_users
        add constraint tpv_users_role_check
        check (role in ('admin', 'barra', 'cocina', 'camarero'));
      exception
        when duplicate_object then null;
      end;
    end
    $$;
  `);
  await query("alter table tpv_users add column if not exists history_area text");
  await query("create unique index if not exists tpv_users_name_unique on tpv_users (lower(name))");
  await query(`
    do $$
    begin
      if not exists (
        select 1
        from pg_constraint
        where conname = 'tpv_users_history_area_check'
      ) then
        alter table tpv_users
        add constraint tpv_users_history_area_check
        check (history_area is null or history_area in ('kitchen', 'bar'));
      end if;
    end
    $$;
  `);

  usersTableReady = true;
}

export async function countUsers() {
  await ensureUsersTable();
  const result = await query("select count(*)::integer as count from tpv_users");
  return result.rows[0]?.count ?? 0;
}

export async function listUsers() {
  await ensureUsersTable();
  const result = await query(`
    select id, name, role, history_area, active, created_at, updated_at
    from tpv_users
    order by created_at asc
  `);
  return result.rows.map(normalizeUser);
}

export async function getUser(id) {
  await ensureUsersTable();
  const result = await query(
    `
      select id, name, role, history_area, active, created_at, updated_at
      from tpv_users
      where id = $1
    `,
    [id],
  );

  return result.rows[0] ? normalizeUser(result.rows[0]) : null;
}

async function countActiveAdmins({ excludeId = "" } = {}) {
  await ensureUsersTable();
  const result = await query(
    `
      select count(*)::integer as count
      from tpv_users
      where role = 'admin'
        and active = true
        and ($1::uuid is null or id <> $1::uuid)
    `,
    [excludeId || null],
  );

  return result.rows[0]?.count ?? 0;
}

export async function createUser({ name, password, role = "barra", historyArea = null, active = true }) {
  await ensureUsersTable();

  const trimmedName = String(name || "").trim();
  const normalizedEmail = getInternalEmail(trimmedName);
  const normalizedRole = normalizeRole(role);
  const normalizedHistoryArea = normalizedRole === "admin" ? normalizeHistoryArea(historyArea) : null;

  if (!trimmedName) throw new Error("El usuario es obligatorio");
  if (!password || String(password).length < 6) throw new Error("La clave debe tener al menos 6 caracteres");

  const result = await query(
    `
      insert into tpv_users (name, email, password_hash, role, history_area, active)
      values ($1, $2, $3, $4, $5, $6)
      returning id, name, role, history_area, active, created_at, updated_at
    `,
    [trimmedName, normalizedEmail, hashPassword(password), normalizedRole, normalizedHistoryArea, Boolean(active)],
  );

  return normalizeUser(result.rows[0]);
}

export async function updateUser(id, payload) {
  await ensureUsersTable();

  const current = await getUser(id);
  if (!current) return null;

  const trimmedName = String(payload.name || "").trim();
  const normalizedEmail = getInternalEmail(trimmedName);
  const normalizedRole = normalizeRole(payload.role);
  const normalizedHistoryArea = normalizedRole === "admin" ? normalizeHistoryArea(payload.historyArea) : null;
  const active = payload.active ?? current.active;
  const normalizedActive = Boolean(active);
  const password = String(payload.password || "");

  if (!trimmedName) throw new Error("El usuario es obligatorio");
  if (password && password.length < 6) throw new Error("La clave debe tener al menos 6 caracteres");

  if (current.role === "admin" && current.active && (normalizedRole !== "admin" || !normalizedActive)) {
    const otherActiveAdmins = await countActiveAdmins({ excludeId: id });
    if (otherActiveAdmins === 0) throw new Error("Debe quedar al menos un administrador activo");
  }

  const result = await query(
    password
      ? `
          update tpv_users
          set name = $2,
              email = $3,
              password_hash = $4,
              role = $5,
              history_area = $6,
              active = $7,
              updated_at = now()
          where id = $1
          returning id, name, role, history_area, active, created_at, updated_at
        `
      : `
          update tpv_users
          set name = $2,
              email = $3,
              role = $4,
              history_area = $5,
              active = $6,
              updated_at = now()
          where id = $1
          returning id, name, role, history_area, active, created_at, updated_at
        `,
    password
      ? [id, trimmedName, normalizedEmail, hashPassword(password), normalizedRole, normalizedHistoryArea, normalizedActive]
      : [id, trimmedName, normalizedEmail, normalizedRole, normalizedHistoryArea, normalizedActive],
  );

  return result.rows[0] ? normalizeUser(result.rows[0]) : null;
}

export async function deleteUser(id) {
  await ensureUsersTable();

  const current = await getUser(id);
  if (!current) return false;

  if (current.role === "admin" && current.active) {
    const otherActiveAdmins = await countActiveAdmins({ excludeId: id });
    if (otherActiveAdmins === 0) throw new Error("Debe quedar al menos un administrador activo");
  }

  const result = await query("delete from tpv_users where id = $1 returning id", [id]);
  return result.rowCount > 0;
}

export async function authenticateUser(name, password) {
  await ensureUsersTable();

  const normalizedName = String(name || "").trim();
  const result = await query(
    `
      select id, name, role, history_area, active, password_hash, created_at, updated_at
      from tpv_users
      where lower(name) = lower($1)
      limit 1
    `,
    [normalizedName],
  );

  const row = result.rows[0];
  if (!row || !row.active) throw new Error("Credenciales no válidas");
  if (!verifyPassword(password, row.password_hash)) throw new Error("Credenciales no válidas");

  return normalizeUser(row);
}

export async function createSessionToken(user) {
  return createAuthToken({
    sub: user.id,
    role: user.role,
    historyArea: user.historyArea,
    name: user.name,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
  });
}

export async function readSessionToken(token) {
  return verifyAuthToken(token);
}
