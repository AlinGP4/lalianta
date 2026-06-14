import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createAuthToken, verifyAuthToken } from "./auth-token";
import { query } from "./db";

let usersTableReady = false;

function normalizeUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
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

async function ensureUsersTable() {
  if (usersTableReady) return;

  await query("create extension if not exists pgcrypto");
  await query(`
    create table if not exists tpv_users (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      email text not null unique,
      password_hash text not null,
      role text not null check (role in ('admin', 'worker')),
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
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
    select id, name, email, role, active, created_at, updated_at
    from tpv_users
    order by created_at asc
  `);
  return result.rows.map(normalizeUser);
}

export async function createUser({ name, email, password, role = "worker", active = true }) {
  await ensureUsersTable();

  const trimmedName = String(name || "").trim();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedRole = role === "admin" ? "admin" : "worker";

  if (!trimmedName) throw new Error("El nombre es obligatorio");
  if (!normalizedEmail) throw new Error("El email es obligatorio");
  if (!password || String(password).length < 6) throw new Error("La clave debe tener al menos 6 caracteres");

  const result = await query(
    `
      insert into tpv_users (name, email, password_hash, role, active)
      values ($1, $2, $3, $4, $5)
      returning id, name, email, role, active, created_at, updated_at
    `,
    [trimmedName, normalizedEmail, hashPassword(password), normalizedRole, Boolean(active)],
  );

  return normalizeUser(result.rows[0]);
}

export async function authenticateUser(email, password) {
  await ensureUsersTable();

  const normalizedEmail = String(email || "").trim().toLowerCase();
  const result = await query(
    `
      select id, name, email, role, active, password_hash, created_at, updated_at
      from tpv_users
      where email = $1
      limit 1
    `,
    [normalizedEmail],
  );

  const row = result.rows[0];
  if (!row || !row.active) throw new Error("Credenciales no validas");
  if (!verifyPassword(password, row.password_hash)) throw new Error("Credenciales no validas");

  return normalizeUser(row);
}

export async function createSessionToken(user) {
  return createAuthToken({
    sub: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
  });
}

export async function readSessionToken(token) {
  return verifyAuthToken(token);
}
