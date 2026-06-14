create extension if not exists pgcrypto;

create table if not exists tpv_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  price_cents integer not null check (price_cents >= 0),
  stock integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tpv_tables (
  id uuid primary key default gen_random_uuid(),
  table_number integer not null unique check (table_number > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tpv_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  role text not null check (role in ('admin', 'worker')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
);

create table if not exists tpv_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references tpv_orders(id) on delete cascade,
  product_id uuid references tpv_products(id) on delete set null,
  product_name text not null,
  source text not null default 'waiter',
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  created_at timestamptz not null default now()
);
