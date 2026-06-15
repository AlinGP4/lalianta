import { query } from "./db";

let settingsTableReady = false;

async function ensureSettingsTable() {
  if (settingsTableReady) return;

  await query(`
    create table if not exists tpv_settings (
      key text primary key,
      value text not null,
      updated_at timestamptz not null default now()
    )
  `);

  settingsTableReady = true;
}

async function getSetting(key, fallbackValue) {
  await ensureSettingsTable();
  const result = await query("select value from tpv_settings where key = $1", [key]);
  return result.rows[0]?.value ?? fallbackValue;
}

async function setSetting(key, value) {
  await ensureSettingsTable();
  await query(
    `
      insert into tpv_settings (key, value, updated_at)
      values ($1, $2, now())
      on conflict (key)
      do update set value = excluded.value, updated_at = now()
    `,
    [key, value],
  );
}

export async function isCustomerOrderingEnabled() {
  const value = await getSetting("customer_ordering_enabled", "true");
  return value === "true";
}

export async function setCustomerOrderingEnabled(enabled) {
  await setSetting("customer_ordering_enabled", enabled ? "true" : "false");
  return isCustomerOrderingEnabled();
}

export async function isCashRegisterOpen() {
  const value = await getSetting("cash_register_open", "true");
  return value === "true";
}

export async function setCashRegisterOpen(open) {
  await setSetting("cash_register_open", open ? "true" : "false");
  return isCashRegisterOpen();
}

export async function getCustomerOrderingState() {
  const [cashOpen, customerOrderingEnabled] = await Promise.all([
    isCashRegisterOpen(),
    isCustomerOrderingEnabled(),
  ]);

  return {
    cashOpen,
    customerOrderingEnabled,
    enabled: cashOpen && customerOrderingEnabled,
    blockedReason: !cashOpen ? "cash_closed" : customerOrderingEnabled ? "" : "qr_blocked",
  };
}
